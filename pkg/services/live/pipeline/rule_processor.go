package pipeline

import (
	"context"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/live"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type RuleProcessor struct {
	pipeline           *Pipeline
	autoJsonConverter  *AutoJsonConverter
	exactJsonConverter *ExactJsonConverter
	frameStorage       *FrameStorage
}

func NewRuleProcessor(pipeline *Pipeline) *RuleProcessor {
	return &RuleProcessor{
		pipeline:     pipeline,
		frameStorage: NewFrameStorage(),
	}
}

func splitChannel(chID string) (live.Channel, error) {
	parts := strings.SplitN(chID, "/", 3)
	ch := live.Channel{}
	if len(parts) == 3 {
		ch.Scope = parts[0]
		ch.Namespace = parts[1]
		ch.Path = parts[2]
	} else if len(parts) == 2 {
		ch.Scope = parts[0]
		ch.Namespace = parts[1]
	} else if len(parts) == 1 {
		ch.Scope = parts[0]
	} else {
		return ch, live.ErrInvalidChannelID
	}
	return ch, nil
}

func (p *RuleProcessor) DataToFrames(ctx context.Context, orgID int64, channelID string, body []byte) ([]*data.Frame, bool, error) {
	rule, ruleOk, err := p.pipeline.Get(orgID, channelID)
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

	channel, err := splitChannel(channelID)
	if err != nil {
		logger.Error("Error splitting channel", "error", err, "channel", channelID)
		return nil, false, err
	}

	vars := Vars{
		OrgID:     orgID,
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

func (p *RuleProcessor) ProcessFrame(ctx context.Context, orgID int64, channelID string, frame *data.Frame) error {
	rule, ruleOk, err := p.pipeline.Get(orgID, channelID)
	if err != nil {
		logger.Error("Error getting rule", "error", err)
		return err
	}
	if !ruleOk {
		logger.Debug("Rule not found", "channel", channelID)
		return nil
	}

	ch, err := splitChannel(channelID)
	if err != nil {
		logger.Error("Error splitting channel", "error", err, "channel", channelID)
		return err
	}

	vars := ProcessorVars{
		Vars: Vars{
			OrgID:     orgID,
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
