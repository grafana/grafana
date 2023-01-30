package pipeline

import (
	"context"
	"fmt"

	"github.com/centrifugal/centrifuge"

	"github.com/grafana/grafana/pkg/services/live/managedstream"
	"github.com/grafana/grafana/pkg/services/secrets"
)

type StorageRuleBuilder struct {
	Node                 *centrifuge.Node
	ManagedStream        *managedstream.Runner
	FrameStorage         *FrameStorage
	Storage              Storage
	ChannelHandlerGetter ChannelHandlerGetter
	SecretsService       secrets.Service
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
			config.AutoJsonConverterConfig = &AutoJsonConverterConfig{}
		}
		return NewAutoJsonConverter(*config.AutoJsonConverterConfig), nil
	case ConverterTypeJsonFrame:
		if config.JsonFrameConverterConfig == nil {
			config.JsonFrameConverterConfig = &JsonFrameConverterConfig{}
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

func (f *StorageRuleBuilder) extractFrameProcessor(config *FrameProcessorConfig) (FrameProcessor, error) {
	if config == nil {
		return nil, nil
	}
	missingConfiguration := fmt.Errorf("missing configuration for %s", config.Type)
	switch config.Type {
	case FrameProcessorTypeDropFields:
		if config.DropFieldsProcessorConfig == nil {
			return nil, missingConfiguration
		}
		return NewDropFieldsFrameProcessor(*config.DropFieldsProcessorConfig), nil
	case FrameProcessorTypeKeepFields:
		if config.KeepFieldsProcessorConfig == nil {
			return nil, missingConfiguration
		}
		return NewKeepFieldsFrameProcessor(*config.KeepFieldsProcessorConfig), nil
	case FrameProcessorTypeMultiple:
		if config.MultipleProcessorConfig == nil {
			return nil, missingConfiguration
		}
		var processors []FrameProcessor
		for _, outConf := range config.MultipleProcessorConfig.Processors {
			out := outConf
			proc, err := f.extractFrameProcessor(&out)
			if err != nil {
				return nil, err
			}
			processors = append(processors, proc)
		}
		return NewMultipleFrameProcessor(processors...), nil
	default:
		return nil, fmt.Errorf("unknown processor type: %s", config.Type)
	}
}

func (f *StorageRuleBuilder) extractFrameConditionChecker(config *FrameConditionCheckerConfig) (FrameConditionChecker, error) {
	if config == nil {
		return nil, nil
	}
	missingConfiguration := fmt.Errorf("missing configuration for %s", config.Type)
	switch config.Type {
	case FrameConditionCheckerTypeNumberCompare:
		if config.NumberCompareConditionConfig == nil {
			return nil, missingConfiguration
		}
		c := *config.NumberCompareConditionConfig
		return NewFrameNumberCompareCondition(c.FieldName, c.Op, c.Value), nil
	case FrameConditionCheckerTypeMultiple:
		var conditions []FrameConditionChecker
		if config.MultipleConditionCheckerConfig == nil {
			return nil, missingConfiguration
		}
		for _, outConf := range config.MultipleConditionCheckerConfig.Conditions {
			out := outConf
			cond, err := f.extractFrameConditionChecker(&out)
			if err != nil {
				return nil, err
			}
			conditions = append(conditions, cond)
		}
		return NewMultipleFrameConditionChecker(config.MultipleConditionCheckerConfig.ConditionType, conditions...), nil
	default:
		return nil, fmt.Errorf("unknown condition type: %s", config.Type)
	}
}

func (f *StorageRuleBuilder) constructBasicAuth(writeConfig WriteConfig) (*BasicAuth, error) {
	if writeConfig.Settings.BasicAuth == nil {
		return nil, nil
	}
	var password string
	hasSecurePassword := len(writeConfig.SecureSettings["basicAuthPassword"]) > 0
	if hasSecurePassword {
		passwordBytes, err := f.SecretsService.Decrypt(context.Background(), writeConfig.SecureSettings["basicAuthPassword"])
		if err != nil {
			return nil, fmt.Errorf("basicAuthPassword can't be decrypted: %w", err)
		}
		password = string(passwordBytes)
	} else {
		// Use plain text password (should be removed upon database integration).
		if writeConfig.Settings.BasicAuth != nil {
			password = writeConfig.Settings.BasicAuth.Password
		}
	}
	return &BasicAuth{
		User:     writeConfig.Settings.BasicAuth.User,
		Password: password,
	}, nil
}

func (f *StorageRuleBuilder) extractFrameOutputter(config *FrameOutputterConfig, writeConfigs []WriteConfig) (FrameOutputter, error) {
	if config == nil {
		return nil, nil
	}
	missingConfiguration := fmt.Errorf("missing configuration for %s", config.Type)
	switch config.Type {
	case FrameOutputTypeRedirect:
		if config.RedirectOutputConfig == nil {
			return nil, missingConfiguration
		}
		return NewRedirectFrameOutput(*config.RedirectOutputConfig), nil
	case FrameOutputTypeMultiple:
		if config.MultipleOutputterConfig == nil {
			return nil, missingConfiguration
		}
		var outputters []FrameOutputter
		for _, outConf := range config.MultipleOutputterConfig.Outputters {
			out := outConf
			outputter, err := f.extractFrameOutputter(&out, writeConfigs)
			if err != nil {
				return nil, err
			}
			outputters = append(outputters, outputter)
		}
		return NewMultipleFrameOutput(outputters...), nil
	case FrameOutputTypeManagedStream:
		return NewManagedStreamFrameOutput(f.ManagedStream), nil
	case FrameOutputTypeLocalSubscribers:
		return NewLocalSubscribersFrameOutput(f.Node), nil
	case FrameOutputTypeConditional:
		if config.ConditionalOutputConfig == nil {
			return nil, missingConfiguration
		}
		condition, err := f.extractFrameConditionChecker(config.ConditionalOutputConfig.Condition)
		if err != nil {
			return nil, err
		}
		outputter, err := f.extractFrameOutputter(config.ConditionalOutputConfig.Outputter, writeConfigs)
		if err != nil {
			return nil, err
		}
		return NewConditionalOutput(condition, outputter), nil
	case FrameOutputTypeThreshold:
		if config.ThresholdOutputConfig == nil {
			return nil, missingConfiguration
		}
		return NewThresholdOutput(f.FrameStorage, *config.ThresholdOutputConfig), nil
	case FrameOutputTypeRemoteWrite:
		if config.RemoteWriteOutputConfig == nil {
			return nil, missingConfiguration
		}
		writeConfig, ok := f.getWriteConfig(config.RemoteWriteOutputConfig.UID, writeConfigs)
		if !ok {
			return nil, fmt.Errorf("unknown write config uid: %s", config.RemoteWriteOutputConfig.UID)
		}
		basicAuth, err := f.constructBasicAuth(writeConfig)
		if err != nil {
			return nil, fmt.Errorf("error getting password: %w", err)
		}
		return NewRemoteWriteFrameOutput(
			writeConfig.Settings.Endpoint,
			basicAuth,
			config.RemoteWriteOutputConfig.SampleMilliseconds,
		), nil
	case FrameOutputTypeLoki:
		if config.LokiOutputConfig == nil {
			return nil, missingConfiguration
		}
		writeConfig, ok := f.getWriteConfig(config.LokiOutputConfig.UID, writeConfigs)
		if !ok {
			return nil, fmt.Errorf("unknown loki backend uid: %s", config.LokiOutputConfig.UID)
		}
		basicAuth, err := f.constructBasicAuth(writeConfig)
		if err != nil {
			return nil, fmt.Errorf("error getting password: %w", err)
		}
		return NewLokiFrameOutput(
			writeConfig.Settings.Endpoint,
			basicAuth,
		), nil
	case FrameOutputTypeChangeLog:
		if config.ChangeLogOutputConfig == nil {
			return nil, missingConfiguration
		}
		return NewChangeLogFrameOutput(f.FrameStorage, *config.ChangeLogOutputConfig), nil
	default:
		return nil, fmt.Errorf("unknown output type: %s", config.Type)
	}
}

func (f *StorageRuleBuilder) extractDataOutputter(config *DataOutputterConfig, writeConfigs []WriteConfig) (DataOutputter, error) {
	if config == nil {
		return nil, nil
	}
	missingConfiguration := fmt.Errorf("missing configuration for %s", config.Type)
	switch config.Type {
	case DataOutputTypeRedirect:
		if config.RedirectDataOutputConfig == nil {
			return nil, missingConfiguration
		}
		return NewRedirectDataOutput(*config.RedirectDataOutputConfig), nil
	case DataOutputTypeLoki:
		if config.LokiOutputConfig == nil {
			return nil, missingConfiguration
		}
		writeConfig, ok := f.getWriteConfig(config.LokiOutputConfig.UID, writeConfigs)
		if !ok {
			return nil, fmt.Errorf("unknown loki backend uid: %s", config.LokiOutputConfig.UID)
		}
		basicAuth, err := f.constructBasicAuth(writeConfig)
		if err != nil {
			return nil, fmt.Errorf("error constructing basicAuth: %w", err)
		}
		return NewLokiDataOutput(
			writeConfig.Settings.Endpoint,
			basicAuth,
		), nil
	case DataOutputTypeBuiltin:
		return NewBuiltinDataOutput(f.ChannelHandlerGetter), nil
	case DataOutputTypeLocalSubscribers:
		return NewLocalSubscribersDataOutput(f.Node), nil
	default:
		return nil, fmt.Errorf("unknown data output type: %s", config.Type)
	}
}

func (f *StorageRuleBuilder) getWriteConfig(uid string, writeConfigs []WriteConfig) (WriteConfig, bool) {
	for _, rwb := range writeConfigs {
		if rwb.UID == uid {
			return rwb, true
		}
	}
	return WriteConfig{}, false
}

func (f *StorageRuleBuilder) BuildRules(ctx context.Context, orgID int64) ([]*LiveChannelRule, error) {
	channelRules, err := f.Storage.ListChannelRules(ctx, orgID)
	if err != nil {
		return nil, err
	}

	writeConfigs, err := f.Storage.ListWriteConfigs(ctx, orgID)
	if err != nil {
		return nil, err
	}

	rules := make([]*LiveChannelRule, 0, len(channelRules))

	for _, ruleConfig := range channelRules {
		rule := &LiveChannelRule{
			OrgId:   orgID,
			Pattern: ruleConfig.Pattern,
		}

		if ruleConfig.Settings.Auth != nil && ruleConfig.Settings.Auth.Subscribe != nil {
			rule.SubscribeAuth = NewRoleCheckAuthorizer(ruleConfig.Settings.Auth.Subscribe.RequireRole)
		}

		if ruleConfig.Settings.Auth != nil && ruleConfig.Settings.Auth.Publish != nil {
			rule.PublishAuth = NewRoleCheckAuthorizer(ruleConfig.Settings.Auth.Publish.RequireRole)
		}

		var err error

		rule.Converter, err = f.extractConverter(ruleConfig.Settings.Converter)
		if err != nil {
			return nil, fmt.Errorf("error building converter for %s: %w", rule.Pattern, err)
		}

		var processors []FrameProcessor
		for _, procConfig := range ruleConfig.Settings.FrameProcessors {
			proc, err := f.extractFrameProcessor(procConfig)
			if err != nil {
				return nil, fmt.Errorf("error building processor for %s: %w", rule.Pattern, err)
			}
			processors = append(processors, proc)
		}
		rule.FrameProcessors = processors

		var dataOutputters []DataOutputter
		for _, outConfig := range ruleConfig.Settings.DataOutputters {
			out, err := f.extractDataOutputter(outConfig, writeConfigs)
			if err != nil {
				return nil, fmt.Errorf("error building data outputter for %s: %w", rule.Pattern, err)
			}
			dataOutputters = append(dataOutputters, out)
		}
		rule.DataOutputters = dataOutputters

		var outputters []FrameOutputter
		for _, outConfig := range ruleConfig.Settings.FrameOutputters {
			out, err := f.extractFrameOutputter(outConfig, writeConfigs)
			if err != nil {
				return nil, fmt.Errorf("error building frame outputter for %s: %w", rule.Pattern, err)
			}
			outputters = append(outputters, out)
		}
		rule.FrameOutputters = outputters

		var subscribers []Subscriber
		for _, subConfig := range ruleConfig.Settings.Subscribers {
			sub, err := f.extractSubscriber(subConfig)
			if err != nil {
				return nil, fmt.Errorf("error building subscriber for %s: %w", rule.Pattern, err)
			}
			subscribers = append(subscribers, sub)
		}
		rule.Subscribers = subscribers

		rules = append(rules, rule)
	}

	return rules, nil
}
