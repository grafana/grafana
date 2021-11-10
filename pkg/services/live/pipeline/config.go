package pipeline

import (
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

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
	Type                     string                    `json:"type"`
	MultipleSubscriberConfig *MultipleSubscriberConfig `json:"multiple,omitempty"`
}

type DataOutputterConfig struct {
	Type                     string                    `json:"type"`
	RedirectDataOutputConfig *RedirectDataOutputConfig `json:"redirect,omitempty"`
	LokiOutputConfig         *LokiOutputConfig         `json:"loki,omitempty"`
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

type AutoJsonConverterConfig struct {
	FieldTips map[string]Field `json:"fieldTips,omitempty"`
}

// Field description.
type Field struct {
	Name   string            `json:"name"`
	Type   data.FieldType    `json:"type"`
	Value  string            `json:"value"` // Can be JSONPath or Goja script.
	Labels []Label           `json:"labels,omitempty"`
	Config *data.FieldConfig `json:"config,omitempty"`
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
