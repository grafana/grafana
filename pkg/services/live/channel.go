package live

import (
	"strings"
)

// ChannelAddress is the channel ID split by parts.
type ChannelAddress struct {
	// Scope is "grafana", "ds", or "plugin".
	Scope string `json:"scope,omitempty"`

	// Namespace meaning depends on the scope.
	// * when grafana, namespace is a "feature"
	// * when ds, namespace is the datasource id
	// * when plugin, namespace is the plugin name
	Namespace string `json:"namespace,omitempty"`

	// Within each namespace, the handler can process the path as needed.
	Path string `json:"path,omitempty"`
}

// ParseChannelAddress parses the parts from a channel ID:
//   ${scope} / ${namespace} / ${path}.
func ParseChannelAddress(id string) ChannelAddress {
	addr := ChannelAddress{}
	parts := strings.SplitN(id, "/", 3)
	length := len(parts)
	if length > 0 {
		addr.Scope = parts[0]
	}
	if length > 1 {
		addr.Namespace = parts[1]
	}
	if length > 2 {
		addr.Path = parts[2]
	}
	return addr
}

// IsValid checks if all parts of the address are valid.
func (ca *ChannelAddress) IsValid() bool {
	return ca.Scope != "" && ca.Namespace != "" && ca.Path != ""
}

// ToChannelID converts this to a single string.
func (ca *ChannelAddress) ToChannelID() string {
	return ca.Scope + "/" + ca.Namespace + "/" + ca.Path
}
