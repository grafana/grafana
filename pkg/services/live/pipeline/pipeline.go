package pipeline

import (
	"context"
	"fmt"
	"os"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/live"
)

type ChannelRuleGetter interface {
	Get(orgID int64, channel string) (*LiveChannelRule, bool, error)
}

// Pipeline allows processing custom input data according to user-defined rules.
// This includes:
// * transforming custom input to data.Frame objects
// * do some processing on these frames
// * output resulting frames to various destinations.
type Pipeline struct {
	ruleGetter ChannelRuleGetter
}

// New creates new Pipeline.
func New(ruleGetter ChannelRuleGetter) (*Pipeline, error) {
	logger.Info("Live pipeline initialization")
	p := &Pipeline{
		ruleGetter: ruleGetter,
	}
	if os.Getenv("GF_LIVE_PIPELINE_DEV") != "" {
		go postTestData() // TODO: temporary for development, remove before merge.
	}
	return p, nil
}

func (p *Pipeline) Get(orgID int64, channel string) (*LiveChannelRule, bool, error) {
	return p.ruleGetter.Get(orgID, channel)
}

func (p *Pipeline) ProcessInput(ctx context.Context, orgID int64, channelID string, body []byte) (bool, error) {
	rule, ok, err := p.ruleGetter.Get(orgID, channelID)
	if err != nil {
		return false, err
	}
	if !ok {
		return false, nil
	}
	channelFrames, ok, err := p.dataToChannelFrames(ctx, *rule, orgID, channelID, body)
	if err != nil {
		return false, err
	}
	if !ok {
		return false, nil
	}
	err = p.processChannelFrames(ctx, orgID, channelID, channelFrames)
	if err != nil {
		return false, fmt.Errorf("error processing frame: %w", err)
	}
	return true, nil
}

func (p *Pipeline) dataToChannelFrames(ctx context.Context, rule LiveChannelRule, orgID int64, channelID string, body []byte) ([]*ChannelFrame, bool, error) {
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

func (p *Pipeline) processChannelFrames(ctx context.Context, orgID int64, channelID string, channelFrames []*ChannelFrame) error {
	for _, channelFrame := range channelFrames {
		var processorChannel = channelID
		if channelFrame.Channel != "" {
			processorChannel = channelFrame.Channel
		}
		err := p.processFrame(ctx, orgID, processorChannel, channelFrame.Frame)
		if err != nil {
			return err
		}
	}
	return nil
}

func (p *Pipeline) processFrame(ctx context.Context, orgID int64, channelID string, frame *data.Frame) error {
	rule, ruleOk, err := p.ruleGetter.Get(orgID, channelID)
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
		if frame == nil {
			return nil
		}
	}

	outputVars := OutputVars{
		ProcessorVars: vars,
	}

	if rule.Outputter != nil {
		frames, err := rule.Outputter.Output(ctx, outputVars, frame)
		if err != nil {
			logger.Error("Error outputting frame", "error", err)
			return err
		}
		if len(frames) > 0 {
			err := p.processChannelFrames(ctx, vars.OrgID, vars.Channel, frames)
			if err != nil {
				return err
			}
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
