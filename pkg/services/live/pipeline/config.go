package pipeline

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/live/managedstream"
	"github.com/grafana/grafana/pkg/services/live/pipeline/pattern"
	"github.com/grafana/grafana/pkg/services/live/pipeline/tree"
	"github.com/grafana/grafana/pkg/setting"

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

type FrameProcessorConfig struct {
	Type                      string                          `json:"type"`
	DropFieldsProcessorConfig *DropFieldsFrameProcessorConfig `json:"dropFields,omitempty"`
	KeepFieldsProcessorConfig *KeepFieldsFrameProcessorConfig `json:"keepFields,omitempty"`
	MultipleProcessorConfig   *MultipleFrameProcessorConfig   `json:"multiple,omitempty"`
}

type MultipleFrameProcessorConfig struct {
	Processors []FrameProcessorConfig `json:"processors"`
}

type MultipleOutputterConfig struct {
	Outputters []FrameOutputterConfig `json:"outputs"`
}

type ManagedStreamOutputConfig struct{}

type ConditionalOutputConfig struct {
	Condition *FrameConditionCheckerConfig `json:"condition"`
	Outputter *FrameOutputterConfig        `json:"output"`
}

type RemoteWriteOutputConfig struct {
	UID                string `json:"uid"`
	SampleMilliseconds int64  `json:"sampleMilliseconds"`
}

type LokiOutputConfig struct {
	UID string `json:"uid"`
}

type FrameOutputterConfig struct {
	Type                    string                     `json:"type"`
	ManagedStreamConfig     *ManagedStreamOutputConfig `json:"managedStream,omitempty"`
	MultipleOutputterConfig *MultipleOutputterConfig   `json:"multiple,omitempty"`
	RedirectOutputConfig    *RedirectOutputConfig      `json:"redirect,omitempty"`
	ConditionalOutputConfig *ConditionalOutputConfig   `json:"conditional,omitempty"`
	ThresholdOutputConfig   *ThresholdOutputConfig     `json:"threshold,omitempty"`
	RemoteWriteOutputConfig *RemoteWriteOutputConfig   `json:"remoteWrite,omitempty"`
	LokiOutputConfig        *LokiOutputConfig          `json:"loki,omitempty"`
	ChangeLogOutputConfig   *ChangeLogOutputConfig     `json:"changeLog,omitempty"`
}

type DataOutputterConfig struct {
	Type                     string                    `json:"type"`
	RedirectDataOutputConfig *RedirectDataOutputConfig `json:"redirect,omitempty"`
	LokiOutputConfig         *LokiOutputConfig         `json:"loki,omitempty"`
}

type MultipleSubscriberConfig struct {
	Subscribers []SubscriberConfig `json:"subscribers"`
}

type SubscriberConfig struct {
	Type                     string                    `json:"type"`
	MultipleSubscriberConfig *MultipleSubscriberConfig `json:"multiple,omitempty"`
}

// ChannelAuthCheckConfig is used to define auth rules for a channel.
type ChannelAuthCheckConfig struct {
	RequireRole models.RoleType `json:"role,omitempty"`
}

type ChannelAuthConfig struct {
	// By default anyone can subscribe.
	Subscribe *ChannelAuthCheckConfig `json:"subscribe,omitempty"`

	// By default HTTP and WS require admin permissions to publish.
	Publish *ChannelAuthCheckConfig `json:"publish,omitempty"`
}

type ChannelRuleSettings struct {
	Auth            *ChannelAuthConfig      `json:"auth,omitempty"`
	Subscribers     []*SubscriberConfig     `json:"subscribers,omitempty"`
	DataOutputters  []*DataOutputterConfig  `json:"dataOutputs,omitempty"`
	Converter       *ConverterConfig        `json:"converter,omitempty"`
	FrameProcessors []*FrameProcessorConfig `json:"frameProcessors,omitempty"`
	FrameOutputters []*FrameOutputterConfig `json:"frameOutputs,omitempty"`
}

type ChannelRule struct {
	OrgId    int64               `json:"-"`
	Pattern  string              `json:"pattern"`
	Settings ChannelRuleSettings `json:"settings"`
}

func (r ChannelRule) Valid() (bool, string) {
	ok, reason := pattern.Valid(r.Pattern)
	if !ok {
		return false, fmt.Sprintf("invalid pattern: %s", reason)
	}
	if r.Settings.Converter != nil {
		if !typeRegistered(r.Settings.Converter.Type, ConvertersRegistry) {
			return false, fmt.Sprintf("unknown converter type: %s", r.Settings.Converter.Type)
		}
	}
	if len(r.Settings.Subscribers) > 0 {
		for _, sub := range r.Settings.Subscribers {
			if !typeRegistered(sub.Type, SubscribersRegistry) {
				return false, fmt.Sprintf("unknown subscriber type: %s", sub.Type)
			}
		}
	}
	if len(r.Settings.FrameProcessors) > 0 {
		for _, proc := range r.Settings.FrameProcessors {
			if !typeRegistered(proc.Type, FrameProcessorsRegistry) {
				return false, fmt.Sprintf("unknown processor type: %s", proc.Type)
			}
		}
	}
	if len(r.Settings.FrameOutputters) > 0 {
		for _, out := range r.Settings.FrameOutputters {
			if !typeRegistered(out.Type, FrameOutputsRegistry) {
				return false, fmt.Sprintf("unknown output type: %s", out.Type)
			}
		}
	}
	return true, ""
}

func typeRegistered(entityType string, registry []EntityInfo) bool {
	for _, info := range registry {
		if info.Type == entityType {
			return true
		}
	}
	return false
}

func WriteConfigToDto(b WriteConfig) WriteConfigDto {
	secureFields := make(map[string]bool, len(b.SecureSettings))
	for k := range b.SecureSettings {
		secureFields[k] = true
	}
	return WriteConfigDto{
		UID:          b.UID,
		Settings:     b.Settings,
		SecureFields: secureFields,
	}
}

type WriteConfigDto struct {
	UID          string          `json:"uid"`
	Settings     WriteSettings   `json:"settings"`
	SecureFields map[string]bool `json:"secureFields"`
}

type WriteConfigGetCmd struct {
	UID string `json:"uid"`
}

type WriteConfigCreateCmd struct {
	UID            string            `json:"uid"`
	Settings       WriteSettings     `json:"settings"`
	SecureSettings map[string]string `json:"secureSettings"`
}

// TODO: add version field later.
type WriteConfigUpdateCmd struct {
	UID            string            `json:"uid"`
	Settings       WriteSettings     `json:"settings"`
	SecureSettings map[string]string `json:"secureSettings"`
}

type WriteConfigDeleteCmd struct {
	UID string `json:"uid"`
}

type WriteConfig struct {
	OrgId          int64             `json:"-"`
	UID            string            `json:"uid"`
	Settings       WriteSettings     `json:"settings"`
	SecureSettings map[string][]byte `json:"secureSettings,omitempty"`
}

func (r WriteConfig) Valid() (bool, string) {
	if r.UID == "" {
		return false, "uid required"
	}
	if r.Settings.Endpoint == "" {
		return false, "endpoint required"
	}
	return true, ""
}

type BasicAuth struct {
	// User is a user for remote write request.
	User string `json:"user,omitempty"`
	// Password is a plain text non-encrypted password.
	// TODO: remove after integrating with the database.
	Password string `json:"password,omitempty"`
}

type WriteSettings struct {
	// Endpoint to send streaming frames to.
	Endpoint string `json:"endpoint"`
	// BasicAuth is an optional basic auth settings.
	BasicAuth *BasicAuth `json:"basicAuth,omitempty"`
}

type WriteConfigs struct {
	Configs []WriteConfig `json:"writeConfigs"`
}

type ChannelRules struct {
	Rules []ChannelRule `json:"rules"`
}

func checkRulesValid(orgID int64, rules []ChannelRule) (ok bool, reason string) {
	t := tree.New()
	defer func() {
		if r := recover(); r != nil {
			reason = fmt.Sprintf("%v", r)
			ok = false
		}
	}()
	for _, rule := range rules {
		if rule.OrgId == orgID || (rule.OrgId == 0 && orgID == 1) {
			t.AddRoute("/"+rule.Pattern, struct{}{})
		}
	}
	ok = true
	return ok, reason
}

type MultipleFrameConditionCheckerConfig struct {
	Type       ConditionType                 `json:"type"`
	Conditions []FrameConditionCheckerConfig `json:"conditions"`
}

type NumberCompareFrameConditionConfig struct {
	FieldName string          `json:"fieldName"`
	Op        NumberCompareOp `json:"op"`
	Value     float64         `json:"value"`
}

type FrameConditionCheckerConfig struct {
	Type                           string                               `json:"type"`
	MultipleConditionCheckerConfig *MultipleFrameConditionCheckerConfig `json:"multiple,omitempty"`
	NumberCompareConditionConfig   *NumberCompareFrameConditionConfig   `json:"numberCompare,omitempty"`
}

type ChannelRuleCreateCmd struct {
	Pattern  string              `json:"pattern"`
	Settings ChannelRuleSettings `json:"settings"`
}

type ChannelRuleUpdateCmd struct {
	Pattern  string              `json:"pattern"`
	Settings ChannelRuleSettings `json:"settings"`
}

type ChannelRuleDeleteCmd struct {
	Pattern string `json:"pattern"`
}

type Storage interface {
	ListWriteConfigs(_ context.Context, orgID int64) ([]WriteConfig, error)
	GetWriteConfig(_ context.Context, orgID int64, cmd WriteConfigGetCmd) (WriteConfig, bool, error)
	CreateWriteConfig(_ context.Context, orgID int64, cmd WriteConfigCreateCmd) (WriteConfig, error)
	UpdateWriteConfig(_ context.Context, orgID int64, cmd WriteConfigUpdateCmd) (WriteConfig, error)
	DeleteWriteConfig(_ context.Context, orgID int64, cmd WriteConfigDeleteCmd) error
	ListChannelRules(_ context.Context, orgID int64) ([]ChannelRule, error)
	CreateChannelRule(_ context.Context, orgID int64, cmd ChannelRuleCreateCmd) (ChannelRule, error)
	UpdateChannelRule(_ context.Context, orgID int64, cmd ChannelRuleUpdateCmd) (ChannelRule, error)
	DeleteChannelRule(_ context.Context, orgID int64, cmd ChannelRuleDeleteCmd) error
}

type StorageRuleBuilder struct {
	Node                 *centrifuge.Node
	ManagedStream        *managedstream.Runner
	FrameStorage         *FrameStorage
	Storage              Storage
	ChannelHandlerGetter ChannelHandlerGetter
	EncryptionService    encryption.Service
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
	case ConverterTypeJsonExact:
		if config.ExactJsonConverterConfig == nil {
			return nil, missingConfiguration
		}
		return NewExactJsonConverter(*config.ExactJsonConverterConfig), nil
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
		return NewMultipleFrameConditionChecker(config.MultipleConditionCheckerConfig.Type, conditions...), nil
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
		passwordBytes, err := f.EncryptionService.Decrypt(context.Background(), writeConfig.SecureSettings["basicAuthPassword"], setting.SecretKey)
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

	var rules []*LiveChannelRule

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
