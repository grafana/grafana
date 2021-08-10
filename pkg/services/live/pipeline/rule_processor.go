package pipeline

import (
	"context"
	"errors"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/live"
)

type RuleProcessor struct {
	pipeline           *Pipeline
	autoJsonConverter  *autoJsonConverter
	exactJsonConverter *exactJsonConverter
	frameStorage       *FrameStorage
}

func NewRuleProcessor(pipeline *Pipeline) *RuleProcessor {
	return &RuleProcessor{
		pipeline:           pipeline,
		autoJsonConverter:  newJSONConverter(),
		exactJsonConverter: newExactJsonConverter(),
		frameStorage:       NewFrameStorage(),
	}
}

func (p *RuleProcessor) DataToFrame(_ context.Context, orgID int64, channel string, body []byte) (*data.Frame, error) {
	rule, ruleOk, err := p.pipeline.Get(orgID, channel)
	if err != nil {
		logger.Error("Error getting rule", "error", err, "data", string(body))
		return nil, err
	}
	if !ruleOk {
		return nil, nil
	}

	liveChannel, _ := live.ParseChannel(channel)

	var frame *data.Frame

	if rule.Mode == "auto" || rule.Mode == "tip" {
		fields := map[string]Field{}
		if rule.Fields != nil {
			for _, field := range rule.Fields {
				fields[field.Name] = field
			}
		}
		frame, err = p.autoJsonConverter.Convert(liveChannel.Path, body, fields)
		if err != nil {
			logger.Error("Error converting JSON", "error", err)
			return nil, err
		}
	} else if rule.Mode == "exact" {
		frame, err = p.exactJsonConverter.Convert(liveChannel.Path, body, rule.Fields)
		if err != nil {
			logger.Error("Error converting JSON", "error", err)
			return nil, err
		}
	} else {
		logger.Error("Unknown mode", "mode", rule.Mode)
		return nil, errors.New("unknown mode")
	}

	return frame, nil
}

func (p *RuleProcessor) ProcessFrame(_ context.Context, orgID int64, channel string, frame *data.Frame) error {
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
		Scope:     liveChannel.Scope,
		Namespace: liveChannel.Namespace,
		Path:      liveChannel.Path,
		Vars: Vars{
			OrgID: orgID,
		},
	}

	for _, p := range rule.Processors {
		frame, err = p.Process(context.Background(), vars, frame)
		if err != nil {
			logger.Error("Error processing frame", "error", err)
			return err
		}
	}

	outputVars := OutputVars{
		ProcessorVars: vars,
	}

	for _, out := range rule.Outputs {
		err = out.Output(context.Background(), outputVars, frame)
		if err != nil {
			logger.Error("Error outputting frame", "error", err)
			return err
		}
	}

	return nil
}
