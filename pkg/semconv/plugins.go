package semconv

import (
	"fmt"

	"go.opentelemetry.io/otel/attribute"
)

// PluginSourceClass converts a plugin source class to the corresponding semantic convention attribute.
func PluginSourceClass(class fmt.Stringer) attribute.KeyValue {
	switch class.String() {
	case "core":
		return GrafanaPluginSourceClassCore
	case "cdn":
		return GrafanaPluginSourceClassCdn
	case "external":
		return GrafanaPluginSourceClassExternal
	default:
		return GrafanaPluginSourceClassUnknown
	}
}
