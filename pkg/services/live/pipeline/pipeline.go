package pipeline

import (
	"context"

	"github.com/centrifugal/centrifuge"

	"github.com/grafana/grafana/pkg/services/live/managedstream"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type Pipeline struct {
	managedStream *managedstream.Runner
	ruleProcessor *RuleProcessor
	cache         *Cache
}

// New ...
func New(managedStream *managedstream.Runner, node *centrifuge.Node) (*Pipeline, error) {
	p := &Pipeline{
		managedStream: managedStream,
	}
	logger.Info("Live pipeline initialization")
	storage := &fileStorage{node: node, managedStream: p.managedStream, frameStorage: NewFrameStorage()}
	ruleProcessor := NewRuleProcessor(p)
	storage.ruleProcessor = ruleProcessor
	p.cache = NewCache(storage)
	p.ruleProcessor = NewRuleProcessor(p)
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
	return p.ruleProcessor.DataToFrames(ctx, orgID, channelID, body)
}

func (p *Pipeline) ProcessChannelFrames(ctx context.Context, orgID int64, channelID string, channelFrames []*ChannelFrame) error {
	for _, channelFrame := range channelFrames {
		var processorChannel = channelID
		if channelFrame.Channel != "" {
			processorChannel = channelFrame.Channel
		}
		err := p.ruleProcessor.ProcessFrame(ctx, orgID, processorChannel, channelFrame.Frame)
		if err != nil {
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
