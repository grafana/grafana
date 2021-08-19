package pipeline

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/live"
)

type fileStorage struct {
	gLive         *live.GrafanaLive
	frameStorage  *FrameStorage
	ruleProcessor *RuleProcessor
}

type JsonAutoSettings struct{}

type ConverterConfig struct {
	Type                      string                     `json:"type"`
	AutoJsonConverterConfig   *AutoJsonConverterConfig   `json:"jsonAuto,omitempty"`
	ExactJsonConverterConfig  *ExactJsonConverterConfig  `json:"jsonExact,omitempty"`
	AutoInfluxConverterConfig *AutoInfluxConverterConfig `json:"influxAuto,omitempty"`
}

type ProcessorConfig struct {
	Type                      string                     `json:"type"`
	DropFieldsProcessorConfig *DropFieldsProcessorConfig `json:"dropFields,omitempty"`
	KeepFieldsProcessorConfig *KeepFieldsProcessorConfig `json:"keepFields,omitempty"`
	MultipleProcessorConfig   *MultipleProcessorConfig   `json:"multiple,omitempty"`
}

type MultipleProcessorConfig struct {
	Processors []ProcessorConfig `json:"processors"`
}

type MultipleOutputterConfig struct {
	Outputters []OutputterConfig `json:"outputters"`
}

type ManagedStreamOutputConfig struct{}

type ConditionalOutputConfig struct {
	Condition *ConditionCheckerConfig `json:"condition"`
	Outputter *OutputterConfig        `json:"outputter"`
}

type OutputterConfig struct {
	Type                    string                     `json:"type"`
	ManagedStreamConfig     *ManagedStreamOutputConfig `json:"managedStream,omitempty"`
	MultipleOutputterConfig *MultipleOutputterConfig   `json:"multiple,omitempty"`
	ChannelOutputConfig     *ChannelOutputConfig       `json:"channel,omitempty"`
	ConditionalOutputConfig *ConditionalOutputConfig   `json:"conditional,omitempty"`
	ThresholdOutputConfig   *ThresholdOutputConfig     `json:"threshold,omitempty"`
	RemoteWriteOutputConfig *RemoteWriteOutputConfig   `json:"remoteWrite,omitempty"`
	ChangeLogOutputConfig   *ChangeLogOutputConfig     `json:"changeLog,omitempty"`
}

type ChannelRuleSettings struct {
	Converter *ConverterConfig `json:"converter,omitempty"`
	Processor *ProcessorConfig `json:"processor,omitempty"`
	Outputter *OutputterConfig `json:"outputter,omitempty"`
}

type ChannelRule struct {
	Pattern  string              `json:"pattern"`
	Settings ChannelRuleSettings `json:"settings"`
}

type ChannelRules struct {
	Rules []ChannelRule `json:"rules"`
}

func (f *fileStorage) extractConverter(config *ConverterConfig) (Converter, error) {
	if config == nil {
		return nil, nil
	}
	missingConfiguration := fmt.Errorf("missing configuration for %s", config.Type)
	switch config.Type {
	case "jsonAuto":
		// TODO: nil checks for all types.
		if config.AutoJsonConverterConfig == nil {
			return nil, missingConfiguration
		}
		return NewAutoJsonConverter(*config.AutoJsonConverterConfig), nil
	case "jsonExact":
		if config.ExactJsonConverterConfig == nil {
			return nil, missingConfiguration
		}
		return NewExactJsonConverter(*config.ExactJsonConverterConfig), nil
	case "influxAuto":
		if config.AutoInfluxConverterConfig == nil {
			return nil, missingConfiguration
		}
		return NewAutoInfluxConverter(*config.AutoInfluxConverterConfig), nil
	default:
		return nil, fmt.Errorf("unknown converter type: %s", config.Type)
	}
}

func (f *fileStorage) extractProcessor(config *ProcessorConfig) (Processor, error) {
	if config == nil {
		return nil, nil
	}
	missingConfiguration := fmt.Errorf("missing configuration for %s", config.Type)
	switch config.Type {
	case "dropFields":
		if config.DropFieldsProcessorConfig == nil {
			return nil, missingConfiguration
		}
		return NewDropFieldsProcessor(*config.DropFieldsProcessorConfig), nil
	case "keepFields":
		if config.KeepFieldsProcessorConfig == nil {
			return nil, missingConfiguration
		}
		return NewKeepFieldsProcessor(*config.KeepFieldsProcessorConfig), nil
	case "multiple":
		if config.MultipleProcessorConfig == nil {
			return nil, missingConfiguration
		}
		var processors []Processor
		for _, outConf := range config.MultipleProcessorConfig.Processors {
			proc, err := f.extractProcessor(&outConf)
			if err != nil {
				return nil, err
			}
			processors = append(processors, proc)
		}
		return NewMultipleProcessor(processors...), nil
	default:
		return nil, fmt.Errorf("unknown processor type: %s", config.Type)
	}
}

type MultipleConditionCheckerConfig struct {
	Type       ConditionType            `json:"type"`
	Conditions []ConditionCheckerConfig `json:"conditions"`
}

type ConditionCheckerConfig struct {
	Type                           string                          `json:"type"`
	MultipleConditionCheckerConfig *MultipleConditionCheckerConfig `json:"multiple,omitempty"`
	NumberCompareConditionConfig   *NumberCompareConditionConfig   `json:"numberCompare,omitempty"`
}

func (f *fileStorage) extractConditionChecker(config *ConditionCheckerConfig) (ConditionChecker, error) {
	if config == nil {
		return nil, nil
	}
	missingConfiguration := fmt.Errorf("missing configuration for %s", config.Type)
	switch config.Type {
	case "numberCompare":
		if config.NumberCompareConditionConfig == nil {
			return nil, missingConfiguration
		}
		return NewNumberCompareCondition(*config.NumberCompareConditionConfig), nil
	case "multiple":
		var conditions []ConditionChecker
		if config.MultipleConditionCheckerConfig == nil {
			return nil, missingConfiguration
		}
		for _, outConf := range config.MultipleConditionCheckerConfig.Conditions {
			cond, err := f.extractConditionChecker(&outConf)
			if err != nil {
				return nil, err
			}
			conditions = append(conditions, cond)
		}
		return NewMultipleConditionChecker(config.MultipleConditionCheckerConfig.Type, conditions), nil
	default:
		return nil, fmt.Errorf("unknown condition type: %s", config.Type)
	}
}

func (f *fileStorage) extractOutputter(config *OutputterConfig) (Outputter, error) {
	if config == nil {
		return nil, nil
	}
	switch config.Type {
	case "channel":
		// TODO: nil checks for all types.
		return NewChannelOutput(f.ruleProcessor, *config.ChannelOutputConfig), nil
	case "multiple":
		var outputters []Outputter
		for _, outConf := range config.MultipleOutputterConfig.Outputters {
			out, err := f.extractOutputter(&outConf)
			if err != nil {
				return nil, err
			}
			outputters = append(outputters, out)
		}
		return NewMultipleOutputter(outputters...), nil
	case "managedStream":
		return NewManagedStreamOutput(f.gLive), nil
	case "conditional":
		condition, err := f.extractConditionChecker(config.ConditionalOutputConfig.Condition)
		if err != nil {
			return nil, err
		}
		outputter, err := f.extractOutputter(config.ConditionalOutputConfig.Outputter)
		if err != nil {
			return nil, err
		}
		return NewConditionalOutput(condition, outputter), nil
	case "threshold":
		return NewThresholdOutput(f.frameStorage, f.ruleProcessor, *config.ThresholdOutputConfig), nil
	case "remoteWrite":
		return NewRemoteWriteOutput(*config.RemoteWriteOutputConfig), nil
	case "changeLog":
		return NewChangeLogOutput(f.frameStorage, f.ruleProcessor, *config.ChangeLogOutputConfig), nil
	default:
		return nil, fmt.Errorf("unknown output type: %s", config.Type)
	}
}

func (f *fileStorage) ListChannelRules(ctx context.Context, cmd ListLiveChannelRuleCommand) ([]*LiveChannelRule, error) {
	ruleBytes, _ := ioutil.ReadFile(os.Getenv("GF_LIVE_CHANNEL_RULES_FILE"))
	var channelRules ChannelRules
	err := json.Unmarshal(ruleBytes, &channelRules)
	if err != nil {
		return nil, err
	}

	s, _ := json.Marshal(channelRules)
	println(string(s))

	var rules []*LiveChannelRule

	for _, ruleConfig := range channelRules.Rules {
		rule := &LiveChannelRule{
			Pattern: ruleConfig.Pattern,
		}
		var err error
		rule.Converter, err = f.extractConverter(ruleConfig.Settings.Converter)
		if err != nil {
			return nil, err
		}
		rule.Processor, err = f.extractProcessor(ruleConfig.Settings.Processor)
		if err != nil {
			return nil, err
		}
		rule.Outputter, err = f.extractOutputter(ruleConfig.Settings.Outputter)
		if err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}

	return rules, nil
}

type fakeStorage struct {
	gLive         *live.GrafanaLive
	frameStorage  *FrameStorage
	ruleProcessor *RuleProcessor
}

func (f *fakeStorage) ListChannelRules(_ context.Context, _ ListLiveChannelRuleCommand) ([]*LiveChannelRule, error) {
	return []*LiveChannelRule{
		{
			OrgId:   1,
			Pattern: "stream/influx/input",
			Converter: NewAutoInfluxConverter(AutoInfluxConverterConfig{
				FrameFormat: "labels_column",
			}),
		},
		{
			OrgId:     1,
			Pattern:   "stream/influx/input/*",
			Outputter: NewManagedStreamOutput(f.gLive),
		},
		{
			OrgId:   1,
			Pattern: "stream/influx/input/cpu",
			// TODO: Would be fine to have KeepLabelsProcessor, but we need to know frame type
			// since there are cases when labels attached to a field, and cases where labels
			// set in a first frame column (in Influx converter). For example, this will allow
			// to leave only "total-cpu" data while dropping individual CPUs.
			Processor: NewKeepFieldsProcessor(KeepFieldsProcessorConfig{
				FieldNames: []string{"labels", "time", "usage_user"},
			}),
			Outputter: NewMultipleOutputter(
				NewManagedStreamOutput(f.gLive),
				NewConditionalOutput(
					NewNumberCompareCondition(NumberCompareConditionConfig{"usage_user", "gte", 50}),
					NewChannelOutput(f.ruleProcessor, ChannelOutputConfig{
						Channel: "stream/influx/input/cpu/spikes",
					}),
				),
			),
		},
		{
			OrgId:     1,
			Pattern:   "stream/influx/input/cpu/spikes",
			Outputter: NewManagedStreamOutput(f.gLive),
		},
		{
			OrgId:     1,
			Pattern:   "stream/json/auto",
			Converter: NewAutoJsonConverter(AutoJsonConverterConfig{}),
			Outputter: NewManagedStreamOutput(f.gLive),
		},
		{
			OrgId:   1,
			Pattern: "stream/json/tip",
			Converter: NewAutoJsonConverter(AutoJsonConverterConfig{
				FieldTips: map[string]Field{
					"value3": {
						Name: "value3",
						Type: data.FieldTypeNullableFloat64,
					},
					"value100": {
						Name: "value100",
						Type: data.FieldTypeNullableFloat64,
					},
				},
			}),
			Processor: NewDropFieldsProcessor(DropFieldsProcessorConfig{
				FieldNames: []string{"value2"},
			}),
			Outputter: NewManagedStreamOutput(f.gLive),
		},
		{
			OrgId:   1,
			Pattern: "stream/json/exact",
			Converter: NewExactJsonConverter(ExactJsonConverterConfig{
				Fields: []Field{
					{
						Name:  "time",
						Type:  data.FieldTypeTime,
						Value: "#{now}",
					},
					{
						Name:  "value1",
						Type:  data.FieldTypeNullableFloat64,
						Value: "$.value1",
					},
					{
						Name:  "value2",
						Type:  data.FieldTypeNullableFloat64,
						Value: "$.value2",
					},
					{
						Name:  "value3",
						Type:  data.FieldTypeNullableFloat64,
						Value: "$.value3",
						Labels: []Label{
							{
								Name:  "host",
								Value: "$.host",
							},
						},
					},
					{
						Name:  "value4",
						Type:  data.FieldTypeNullableFloat64,
						Value: "$.value4",
						Config: &data.FieldConfig{
							Thresholds: &data.ThresholdsConfig{
								Mode: data.ThresholdsModeAbsolute,
								Steps: []data.Threshold{
									{
										Value: 2,
										State: "normal",
									},
									{
										Value: 6,
										State: "warning",
									},
									{
										Value: 8,
										State: "critical",
									},
								},
							},
						},
					},
					{
						Name:  "map.red",
						Type:  data.FieldTypeNullableFloat64,
						Value: "$.map.red",
						Labels: []Label{
							{
								Name:  "host",
								Value: "$.host",
							},
							{
								Name:  "host2",
								Value: "$.host",
							},
						},
					},
					{
						Name:  "annotation",
						Type:  data.FieldTypeNullableString,
						Value: "$.annotation",
					},
					{
						Name:  "running",
						Type:  data.FieldTypeNullableBool,
						Value: "{JSON.parse(x).status === 'running'}",
					},
					{
						Name:  "num_map_colors",
						Type:  data.FieldTypeNullableFloat64,
						Value: "{Object.keys(JSON.parse(x).map).length}",
					},
				},
			}),
			Outputter: NewMultipleOutputter(
				NewManagedStreamOutput(f.gLive),
				NewRemoteWriteOutput(RemoteWriteOutputConfig{
					Endpoint: os.Getenv("GF_LIVE_REMOTE_WRITE_ENDPOINT"),
					User:     os.Getenv("GF_LIVE_REMOTE_WRITE_USER"),
					Password: os.Getenv("GF_LIVE_REMOTE_WRITE_PASSWORD"),
				}),
				NewChangeLogOutput(f.frameStorage, f.ruleProcessor, ChangeLogOutputConfig{
					FieldName: "value3",
					Channel:   "stream/json/exact/value3/changes",
				}),
				NewChangeLogOutput(f.frameStorage, f.ruleProcessor, ChangeLogOutputConfig{
					FieldName: "annotation",
					Channel:   "stream/json/exact/annotation/changes",
				}),
				NewConditionalOutput(
					NewMultipleConditionChecker(
						ConditionAll,
						[]ConditionChecker{
							NewNumberCompareCondition(NumberCompareConditionConfig{"value1", "gte", 3.0}),
							NewNumberCompareCondition(NumberCompareConditionConfig{"value2", "gte", 3.0}),
						},
					),
					NewChannelOutput(f.ruleProcessor, ChannelOutputConfig{
						Channel: "stream/json/exact/condition",
					}),
				),
				NewThresholdOutput(f.frameStorage, f.ruleProcessor, ThresholdOutputConfig{
					FieldName: "value4",
					Channel:   "stream/json/exact/value4/state",
				}),
			),
		},
		{
			OrgId:   1,
			Pattern: "stream/json/exact/value3/changes",
			Outputter: NewMultipleOutputter(
				NewManagedStreamOutput(f.gLive),
				NewRemoteWriteOutput(RemoteWriteOutputConfig{
					Endpoint: os.Getenv("GF_LIVE_REMOTE_WRITE_ENDPOINT"),
					User:     os.Getenv("GF_LIVE_REMOTE_WRITE_USER"),
					Password: os.Getenv("GF_LIVE_REMOTE_WRITE_PASSWORD"),
				}),
			),
		},
		{
			OrgId:     1,
			Pattern:   "stream/json/exact/annotation/changes",
			Outputter: NewManagedStreamOutput(f.gLive),
		},
		{
			OrgId:     1,
			Pattern:   "stream/json/exact/condition",
			Outputter: NewManagedStreamOutput(f.gLive),
		},
		{
			OrgId:     1,
			Pattern:   "stream/json/exact/value4/state",
			Outputter: NewManagedStreamOutput(f.gLive),
		},
	}, nil
}
