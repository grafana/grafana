package pipeline

import (
	"context"

	"github.com/grafana/grafana/pkg/services/live/managedstream"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/live"
)

type Pipeline struct {
	managedStream *managedstream.Runner
	cache         *Cache
}

// New ...
func New(managedStream *managedstream.Runner, node *centrifuge.Node) (*Pipeline, error) {
	p := &Pipeline{
		managedStream: managedStream,
	}
	logger.Info("Live pipeline initialization")
	storage := &fileStorage{
		node:          node,
		managedStream: p.managedStream,
		frameStorage:  NewFrameStorage(),
		pipeline:      p,
	}
	p.cache = NewCache(storage)
	go postTestData() // TODO: temporary for development, remove.
	return p, nil
}

// Run ...
func (p *Pipeline) Run(ctx context.Context) error {
	<-ctx.Done()
	return ctx.Err()
}

func (p *Pipeline) Get(orgID int64, channel string) (*LiveChannelRule, bool, error) {
	return p.cache.Get(orgID, channel)
}

func (p *Pipeline) DataToChannelFrames(ctx context.Context, orgID int64, channelID string, body []byte) ([]*ChannelFrame, bool, error) {
	rule, ruleOk, err := p.Get(orgID, channelID)
	if err != nil {
		logger.Error("Error getting rule", "error", err, "data", string(body))
		return nil, false, err
	}
	if !ruleOk {
		return nil, false, nil
	}
	if rule.Converter == nil {
		return nil, false, nil
	}

	channel, err := live.ParseChannel(channelID)
	if err != nil {
		logger.Error("Error parsing channel", "error", err, "channel", channelID)
		return nil, false, err
	}

	vars := Vars{
		OrgID:     orgID,
		Channel:   channelID,
		Scope:     channel.Scope,
		Namespace: channel.Namespace,
		Path:      channel.Path,
	}

	frames, err := rule.Converter.Convert(ctx, vars, body)
	if err != nil {
		logger.Error("Error converting data", "error", err)
		return nil, false, err
	}

	return frames, true, nil
}

func (p *Pipeline) ProcessChannelFrames(ctx context.Context, orgID int64, channelID string, channelFrames []*ChannelFrame) error {
	for _, channelFrame := range channelFrames {
		var processorChannel = channelID
		if channelFrame.Channel != "" {
			processorChannel = channelFrame.Channel
		}
		err := p.ProcessFrame(ctx, orgID, processorChannel, channelFrame.Frame)
		if err != nil {
			return err
		}
	}
	return nil
}

func (p *Pipeline) ProcessFrame(ctx context.Context, orgID int64, channelID string, frame *data.Frame) error {
	rule, ruleOk, err := p.Get(orgID, channelID)
	if err != nil {
		logger.Error("Error getting rule", "error", err)
		return err
	}
	if !ruleOk {
		logger.Debug("Rule not found", "channel", channelID)
		return nil
	}

	ch, err := live.ParseChannel(channelID)
	if err != nil {
		logger.Error("Error parsing channel", "error", err, "channel", channelID)
		return err
	}

	vars := ProcessorVars{
		Vars: Vars{
			OrgID:     orgID,
			Channel:   channelID,
			Scope:     ch.Scope,
			Namespace: ch.Namespace,
			Path:      ch.Path,
		},
	}

	if rule.Processor != nil {
		frame, err = rule.Processor.Process(ctx, vars, frame)
		if err != nil {
			logger.Error("Error processing frame", "error", err)
			return err
		}
	}

	outputVars := OutputVars{
		ProcessorVars: vars,
	}

	if rule.Outputter != nil {
		err = rule.Outputter.Output(ctx, outputVars, frame)
		if err != nil {
			logger.Error("Error outputting frame", "error", err)
			return err
		}
	}

	return nil
}

type LiveChannelRule struct {
	OrgId     int64
	Pattern   string
	Converter Converter
	Processor Processor
	Outputter Outputter
}

type Label struct {
	Name  string `json:"name"`
	Value string `json:"value"` // Can be JSONPath or Goja script.
}

type Field struct {
	Name   string            `json:"name"`
	Type   data.FieldType    `json:"type"`
	Value  string            `json:"value"` // Can be JSONPath or Goja script.
	Labels []Label           `json:"labels,omitempty"`
	Config *data.FieldConfig `json:"config,omitempty"`
}

type ListLiveChannelRuleCommand struct {
	OrgId int64
}

type Storage interface {
	ListChannelRules(ctx context.Context, cmd ListLiveChannelRuleCommand) ([]*LiveChannelRule, error)
}

type Vars struct {
	OrgID     int64
	Channel   string
	Scope     string
	Namespace string
	Path      string
}

type ProcessorVars struct {
	Vars
}

type OutputVars struct {
	ProcessorVars
}
