package pipeline

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/services/live/managedstream"

	"github.com/centrifugal/centrifuge"
)

type JsonAutoSettings struct{}

type ConverterConfig struct {
	Type                      string                     `json:"type"`
	AutoJsonConverterConfig   *AutoJsonConverterConfig   `json:"jsonAuto,omitempty"`
	ExactJsonConverterConfig  *ExactJsonConverterConfig  `json:"jsonExact,omitempty"`
	AutoInfluxConverterConfig *AutoInfluxConverterConfig `json:"influxAuto,omitempty"`
	JsonFrameConverterConfig  *JsonFrameConverterConfig  `json:"jsonFrame,omitempty"`
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
	Outputters []OutputterConfig `json:"outputs"`
}

type ManagedStreamOutputConfig struct{}

type ConditionalOutputConfig struct {
	Condition *ConditionCheckerConfig `json:"condition"`
	Outputter *OutputterConfig        `json:"output"`
}

type RemoteWriteOutputConfig struct {
	UID string `json:"uid"`
}

type OutputterConfig struct {
	Type                    string                     `json:"type"`
	ManagedStreamConfig     *ManagedStreamOutputConfig `json:"managedStream,omitempty"`
	MultipleOutputterConfig *MultipleOutputterConfig   `json:"multiple,omitempty"`
	RedirectOutputConfig    *RedirectOutputConfig      `json:"redirect,omitempty"`
	ConditionalOutputConfig *ConditionalOutputConfig   `json:"conditional,omitempty"`
	ThresholdOutputConfig   *ThresholdOutputConfig     `json:"threshold,omitempty"`
	RemoteWriteOutputConfig *RemoteWriteOutputConfig   `json:"remoteWrite,omitempty"`
	ChangeLogOutputConfig   *ChangeLogOutputConfig     `json:"changeLog,omitempty"`
}

type MultipleSubscriberConfig struct {
	Subscribers []SubscriberConfig `json:"subscribers"`
}

type SubscriberConfig struct {
	Type                     string                    `json:"type"`
	MultipleSubscriberConfig *MultipleSubscriberConfig `json:"multiple,omitempty"`
}

type ChannelRuleSettings struct {
	Subscriber *SubscriberConfig `json:"subscriber,omitempty"`
	Converter  *ConverterConfig  `json:"converter,omitempty"`
	Processor  *ProcessorConfig  `json:"processor,omitempty"`
	Outputter  *OutputterConfig  `json:"output,omitempty"`
}

type ChannelRule struct {
	OrgId    int64               `json:"-"`
	Pattern  string              `json:"pattern"`
	Settings ChannelRuleSettings `json:"settings"`
}

type RemoteWriteBackend struct {
	OrgId    int64              `json:"-"`
	UID      string             `json:"uid"`
	Settings *RemoteWriteConfig `json:"settings"`
}

type RemoteWriteBackends struct {
	Backends []RemoteWriteBackend `json:"remoteWriteBackends"`
}

type ChannelRules struct {
	Rules []ChannelRule `json:"rules"`
}

type MultipleConditionCheckerConfig struct {
	Type       ConditionType            `json:"type"`
	Conditions []ConditionCheckerConfig `json:"conditions"`
}

type NumberCompareConditionConfig struct {
	FieldName string          `json:"fieldName"`
	Op        NumberCompareOp `json:"op"`
	Value     float64         `json:"value"`
}

type ConditionCheckerConfig struct {
	Type                           string                          `json:"type"`
	MultipleConditionCheckerConfig *MultipleConditionCheckerConfig `json:"multiple,omitempty"`
	NumberCompareConditionConfig   *NumberCompareConditionConfig   `json:"numberCompare,omitempty"`
}

type RuleStorage interface {
	ListRemoteWriteBackends(_ context.Context, orgID int64) ([]RemoteWriteBackend, error)
	ListChannelRules(_ context.Context, orgID int64) ([]ChannelRule, error)
}

type StorageRuleBuilder struct {
	Node                 *centrifuge.Node
	ManagedStream        *managedstream.Runner
	FrameStorage         *FrameStorage
	RuleStorage          RuleStorage
	ChannelHandlerGetter ChannelHandlerGetter
}

func (f *StorageRuleBuilder) extractSubscriber(config *SubscriberConfig) (Subscriber, error) {
	if config == nil {
		return nil, nil
	}
	missingConfiguration := fmt.Errorf("missing configuration for %s", config.Type)
	switch config.Type {
	case SubscriberTypeBuiltin:
		return NewBuiltinSubscriber(f.ChannelHandlerGetter), nil
	case SubscriberTypeManagedStream:
		return NewManagedStreamSubscriber(f.ManagedStream), nil
	case SubscriberTypeMultiple:
		if config.MultipleSubscriberConfig == nil {
			return nil, missingConfiguration
		}
		var subscribers []Subscriber
		for _, outConf := range config.MultipleSubscriberConfig.Subscribers {
			out := outConf
			sub, err := f.extractSubscriber(&out)
			if err != nil {
				return nil, err
			}
			subscribers = append(subscribers, sub)
		}
		return NewMultipleSubscriber(subscribers...), nil
	default:
		return nil, fmt.Errorf("unknown subscriber type: %s", config.Type)
	}
}

func (f *StorageRuleBuilder) extractConverter(config *ConverterConfig) (Converter, error) {
	if config == nil {
		return nil, nil
	}
	missingConfiguration := fmt.Errorf("missing configuration for %s", config.Type)
	switch config.Type {
	case ConverterTypeJsonAuto:
		if config.AutoJsonConverterConfig == nil {
			return nil, missingConfiguration
		}
		return NewAutoJsonConverter(*config.AutoJsonConverterConfig), nil
	case ConverterTypeJsonExact:
		if config.ExactJsonConverterConfig == nil {
			return nil, missingConfiguration
		}
		return NewExactJsonConverter(*config.ExactJsonConverterConfig), nil
	case ConverterTypeJsonFrame:
		if config.JsonFrameConverterConfig == nil {
			return nil, missingConfiguration
		}
		return NewJsonFrameConverter(*config.JsonFrameConverterConfig), nil
	case ConverterTypeInfluxAuto:
		if config.AutoInfluxConverterConfig == nil {
			return nil, missingConfiguration
		}
		return NewAutoInfluxConverter(*config.AutoInfluxConverterConfig), nil
	default:
		return nil, fmt.Errorf("unknown converter type: %s", config.Type)
	}
}

func (f *StorageRuleBuilder) extractProcessor(config *ProcessorConfig) (Processor, error) {
	if config == nil {
		return nil, nil
	}
	missingConfiguration := fmt.Errorf("missing configuration for %s", config.Type)
	switch config.Type {
	case ProcessorTypeDropFields:
		if config.DropFieldsProcessorConfig == nil {
			return nil, missingConfiguration
		}
		return NewDropFieldsProcessor(*config.DropFieldsProcessorConfig), nil
	case ProcessorTypeKeepFields:
		if config.KeepFieldsProcessorConfig == nil {
			return nil, missingConfiguration
		}
		return NewKeepFieldsProcessor(*config.KeepFieldsProcessorConfig), nil
	case ProcessorTypeMultiple:
		if config.MultipleProcessorConfig == nil {
			return nil, missingConfiguration
		}
		var processors []Processor
		for _, outConf := range config.MultipleProcessorConfig.Processors {
			out := outConf
			proc, err := f.extractProcessor(&out)
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

func (f *StorageRuleBuilder) extractConditionChecker(config *ConditionCheckerConfig) (ConditionChecker, error) {
	if config == nil {
		return nil, nil
	}
	missingConfiguration := fmt.Errorf("missing configuration for %s", config.Type)
	switch config.Type {
	case ConditionCheckerTypeNumberCompare:
		if config.NumberCompareConditionConfig == nil {
			return nil, missingConfiguration
		}
		c := *config.NumberCompareConditionConfig
		return NewNumberCompareCondition(c.FieldName, c.Op, c.Value), nil
	case ConditionCheckerTypeMultiple:
		var conditions []ConditionChecker
		if config.MultipleConditionCheckerConfig == nil {
			return nil, missingConfiguration
		}
		for _, outConf := range config.MultipleConditionCheckerConfig.Conditions {
			out := outConf
			cond, err := f.extractConditionChecker(&out)
			if err != nil {
				return nil, err
			}
			conditions = append(conditions, cond)
		}
		return NewMultipleConditionChecker(config.MultipleConditionCheckerConfig.Type, conditions...), nil
	default:
		return nil, fmt.Errorf("unknown condition type: %s", config.Type)
	}
}

func (f *StorageRuleBuilder) extractOutputter(config *OutputterConfig, remoteWriteBackends []RemoteWriteBackend) (Outputter, error) {
	if config == nil {
		return nil, nil
	}
	missingConfiguration := fmt.Errorf("missing configuration for %s", config.Type)
	switch config.Type {
	case OutputTypeRedirect:
		if config.RedirectOutputConfig == nil {
			return nil, missingConfiguration
		}
		return NewRedirectOutput(*config.RedirectOutputConfig), nil
	case OutputTypeMultiple:
		if config.MultipleOutputterConfig == nil {
			return nil, missingConfiguration
		}
		var outputters []Outputter
		for _, outConf := range config.MultipleOutputterConfig.Outputters {
			out := outConf
			outputter, err := f.extractOutputter(&out, remoteWriteBackends)
			if err != nil {
				return nil, err
			}
			outputters = append(outputters, outputter)
		}
		return NewMultipleOutput(outputters...), nil
	case OutputTypeManagedStream:
		return NewManagedStreamOutput(f.ManagedStream), nil
	case OutputTypeLocalSubscribers:
		return NewLocalSubscribersOutput(f.Node), nil
	case OutputTypeConditional:
		if config.ConditionalOutputConfig == nil {
			return nil, missingConfiguration
		}
		condition, err := f.extractConditionChecker(config.ConditionalOutputConfig.Condition)
		if err != nil {
			return nil, err
		}
		outputter, err := f.extractOutputter(config.ConditionalOutputConfig.Outputter, remoteWriteBackends)
		if err != nil {
			return nil, err
		}
		return NewConditionalOutput(condition, outputter), nil
	case OutputTypeThreshold:
		if config.ThresholdOutputConfig == nil {
			return nil, missingConfiguration
		}
		return NewThresholdOutput(f.FrameStorage, *config.ThresholdOutputConfig), nil
	case OutputTypeRemoteWrite:
		if config.RemoteWriteOutputConfig == nil {
			return nil, missingConfiguration
		}
		remoteWriteConfig, ok := f.getRemoteWriteConfig(config.RemoteWriteOutputConfig.UID, remoteWriteBackends)
		if !ok {
			return nil, fmt.Errorf("unknown remote write backend uid: %s", config.RemoteWriteOutputConfig.UID)
		}
		return NewRemoteWriteOutput(*remoteWriteConfig), nil
	case OutputTypeChangeLog:
		if config.ChangeLogOutputConfig == nil {
			return nil, missingConfiguration
		}
		return NewChangeLogOutput(f.FrameStorage, *config.ChangeLogOutputConfig), nil
	default:
		return nil, fmt.Errorf("unknown output type: %s", config.Type)
	}
}

func (f *StorageRuleBuilder) getRemoteWriteConfig(uid string, remoteWriteBackends []RemoteWriteBackend) (*RemoteWriteConfig, bool) {
	for _, rwb := range remoteWriteBackends {
		if rwb.UID == uid {
			return rwb.Settings, true
		}
	}
	return nil, false
}

func (f *StorageRuleBuilder) BuildRules(ctx context.Context, orgID int64) ([]*LiveChannelRule, error) {
	channelRules, err := f.RuleStorage.ListChannelRules(ctx, orgID)
	if err != nil {
		return nil, err
	}

	remoteWriteBackends, err := f.RuleStorage.ListRemoteWriteBackends(ctx, orgID)
	if err != nil {
		return nil, err
	}

	var rules []*LiveChannelRule

	for _, ruleConfig := range channelRules {
		rule := &LiveChannelRule{
			OrgId:   orgID,
			Pattern: ruleConfig.Pattern,
		}
		var err error
		rule.Subscriber, err = f.extractSubscriber(ruleConfig.Settings.Subscriber)
		if err != nil {
			return nil, err
		}
		rule.Converter, err = f.extractConverter(ruleConfig.Settings.Converter)
		if err != nil {
			return nil, err
		}
		rule.Processor, err = f.extractProcessor(ruleConfig.Settings.Processor)
		if err != nil {
			return nil, err
		}
		rule.Outputter, err = f.extractOutputter(ruleConfig.Settings.Outputter, remoteWriteBackends)
		if err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}

	return rules, nil
}
