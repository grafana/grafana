package pipeline

import (
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/services/org"
)

// ChannelAuthCheckConfig is used to define auth rules for a channel.
type ChannelAuthCheckConfig struct {
	RequireRole org.RoleType `json:"role,omitempty"`
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

type ConverterConfig struct {
	Type                      string                     `json:"type" ts_type:"Omit<keyof ConverterConfig, 'type'>"`
	AutoJsonConverterConfig   *AutoJsonConverterConfig   `json:"jsonAuto,omitempty"`
	ExactJsonConverterConfig  *ExactJsonConverterConfig  `json:"jsonExact,omitempty"`
	AutoInfluxConverterConfig *AutoInfluxConverterConfig `json:"influxAuto,omitempty"`
	JsonFrameConverterConfig  *JsonFrameConverterConfig  `json:"jsonFrame,omitempty"`
}

type DropFieldsFrameProcessorConfig struct {
	FieldNames []string `json:"fieldNames"`
}

type KeepFieldsFrameProcessorConfig struct {
	FieldNames []string `json:"fieldNames"`
}

type FrameProcessorConfig struct {
	Type                      string                          `json:"type" ts_type:"Omit<keyof FrameProcessorConfig, 'type'>"`
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

type MultipleSubscriberConfig struct {
	Subscribers []SubscriberConfig `json:"subscribers"`
}

type SubscriberConfig struct {
	Type                     string                    `json:"type" ts_type:"Omit<keyof SubscriberConfig, 'type'>"`
	MultipleSubscriberConfig *MultipleSubscriberConfig `json:"multiple,omitempty"`
}

// RedirectDataOutputConfig ...
type RedirectDataOutputConfig struct {
	Channel string `json:"channel"`
}

type DataOutputterConfig struct {
	Type                     string                    `json:"type" ts_type:"Omit<keyof DataOutputterConfig, 'type'>"`
	RedirectDataOutputConfig *RedirectDataOutputConfig `json:"redirect,omitempty"`
	LokiOutputConfig         *LokiOutputConfig         `json:"loki,omitempty"`
}

type FrameOutputterConfig struct {
	Type                    string                     `json:"type" ts_type:"Omit<keyof FrameOutputterConfig, 'type'>"`
	ManagedStreamConfig     *ManagedStreamOutputConfig `json:"managedStream,omitempty"`
	MultipleOutputterConfig *MultipleOutputterConfig   `json:"multiple,omitempty"`
	RedirectOutputConfig    *RedirectOutputConfig      `json:"redirect,omitempty"`
	ConditionalOutputConfig *ConditionalOutputConfig   `json:"conditional,omitempty"`
	ThresholdOutputConfig   *ThresholdOutputConfig     `json:"threshold,omitempty"`
	RemoteWriteOutputConfig *RemoteWriteOutputConfig   `json:"remoteWrite,omitempty"`
	LokiOutputConfig        *LokiOutputConfig          `json:"loki,omitempty"`
	ChangeLogOutputConfig   *ChangeLogOutputConfig     `json:"changeLog,omitempty"`
}

type MultipleFrameConditionCheckerConfig struct {
	ConditionType ConditionType                 `json:"conditionType"`
	Conditions    []FrameConditionCheckerConfig `json:"conditions"`
}

type NumberCompareFrameConditionConfig struct {
	FieldName string          `json:"fieldName"`
	Op        NumberCompareOp `json:"op"`
	Value     float64         `json:"value"`
}

type FrameConditionCheckerConfig struct {
	Type                           string                               `json:"type" ts_type:"Omit<keyof FrameConditionCheckerConfig, 'type'>"`
	MultipleConditionCheckerConfig *MultipleFrameConditionCheckerConfig `json:"multiple,omitempty"`
	NumberCompareConditionConfig   *NumberCompareFrameConditionConfig   `json:"numberCompare,omitempty"`
}

type AutoJsonConverterConfig struct {
	FieldTips map[string]Field `json:"fieldTips,omitempty"`
}

// Field description.
type Field struct {
	Name   string            `json:"name"`
	Type   data.FieldType    `json:"type"`
	Value  string            `json:"value"` // Can be JSONPath or Goja script.
	Labels []Label           `json:"labels,omitempty"`
	Config *data.FieldConfig `json:"config,omitempty" ts_type:"FieldConfig"`
}

type ExactJsonConverterConfig struct {
	Fields []Field `json:"fields"`
}

// AutoInfluxConverterConfig ...
type AutoInfluxConverterConfig struct {
	FrameFormat string `json:"frameFormat"`
}

type JsonFrameConverterConfig struct{}

type ManagedStreamOutputConfig struct{}
