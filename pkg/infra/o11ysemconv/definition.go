package o11ysemconv

import (
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"go.opentelemetry.io/otel/attribute"
)

const defaultNamespace = "grafana"

type DefinitionOptions struct {
	tracingKey       string
	tracingNamespace string
	tracingSubSystem string
	logKey           string
}

type DefinitionOption func(options *DefinitionOptions)

func WithTracingKey(key string) DefinitionOption {
	return func(options *DefinitionOptions) {
		options.tracingKey = key
	}
}

func WithLogKey(key string) DefinitionOption {
	return func(options *DefinitionOptions) {
		options.logKey = key
	}
}

type definition struct {
	key        string
	tracingKey string
	logKey     string
}

func newDefinition(key string, opts ...DefinitionOption) definition {
	def := definition{
		key:        key,
		logKey:     toKebabCase(key),
		tracingKey: formatTracingKey(key, defaultNamespace, ""),
	}

	options := DefinitionOptions{
		tracingNamespace: defaultNamespace,
		logKey:           def.logKey,
	}

	for _, opt := range opts {
		opt(&options)
	}

	if options.tracingKey != "" {
		def.tracingKey = options.tracingKey
	} else {
		def.tracingKey = formatTracingKey(options.tracingKey, options.tracingNamespace, options.tracingSubSystem)
	}

	def.logKey = options.logKey

	return def
}

func (def definition) Key() string {
	return def.key
}

func (def definition) LogKV(value any) log.KeyValue {
	return log.NewKeyValue(def.logKey, value)
}

func (def definition) LogAttribute(value any) []any {
	return def.LogKV(value).Attribute()
}

type AnyDefinition struct {
	definition
}

func Any(key string, opts ...DefinitionOption) AnyDefinition {
	return AnyDefinition{
		definition: newDefinition(key, opts...),
	}
}

type StringDefinition struct {
	definition
}

func String(key string, opts ...DefinitionOption) StringDefinition {
	return StringDefinition{
		definition: newDefinition(key, opts...),
	}
}

func (def StringDefinition) SpanAttribute(value string) attribute.KeyValue {
	return attribute.String(def.tracingKey, value)
}

type Int64Definition struct {
	definition
}

func Int64(key string, opts ...DefinitionOption) Int64Definition {
	return Int64Definition{
		definition: newDefinition(key, opts...),
	}
}

func (def Int64Definition) SpanAttribute(value int64) attribute.KeyValue {
	return attribute.Int64(def.tracingKey, value)
}

func formatTracingKey(key string, namespace string, subSystem string) string {
	result := ""

	if namespace != "" {
		result += fmt.Sprintf("%s.", toSnakeCase(namespace))
	}

	if subSystem != "" {
		result += fmt.Sprintf("%s.", toSnakeCase(subSystem))
	}

	result += toSnakeCase(key)
	return result
}

func toSnakeCase(val string) string {
	return val
}

func toKebabCase(val string) string {
	return val
}
