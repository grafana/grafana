package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/live"
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

func (p *RuleProcessor) DataToFrame(ctx context.Context, orgID int64, channel string, body []byte) (*data.Frame, bool, error) {
	rule, ruleOk, err := p.pipeline.Get(orgID, channel)
	if err != nil {
		logger.Error("Error getting rule", "error", err, "data", string(body))
		return nil, false, err
	}
	if !ruleOk {
		return nil, false, nil
	}

	liveChannel, _ := live.ParseChannel(channel)

	vars := Vars{
		OrgID:     orgID,
		Scope:     liveChannel.Scope,
		Namespace: liveChannel.Namespace,
		Path:      liveChannel.Path,
	}

	if rule.Converter == nil {
		return nil, false, nil
	}

	frame, err := rule.Converter.Convert(ctx, vars, body)
	if err != nil {
		logger.Error("Error converting data", "error", err)
		return nil, false, err
	}

	return frame, true, nil
}

func (p *RuleProcessor) ProcessFrame(ctx context.Context, orgID int64, channel string, frame *data.Frame) error {
	rule, ruleOk, err := p.pipeline.Get(orgID, channel)
	if err != nil {
		logger.Error("Error getting rule", "error", err)
		return err
	}
	if !ruleOk {
		return nil
	}

	liveChannel, _ := live.ParseChannel(channel)
	vars := ProcessorVars{
		Vars: Vars{
			OrgID:     orgID,
			Scope:     liveChannel.Scope,
			Namespace: liveChannel.Namespace,
			Path:      liveChannel.Path,
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
