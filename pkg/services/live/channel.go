package live

import (
	"strings"
)

// ChannelAddress is the channel ID split by parts.
type ChannelAddress struct {
	// Scope is one of available channel scopes:
	// like ScopeGrafana, ScopePlugin, ScopeDatasource.
	Scope string `json:"scope,omitempty"`

	// Namespace meaning depends on the scope.
	// * when ScopeGrafana, namespace is a "feature"
	// * when ScopePlugin, namespace is the plugin name
	// * when ScopeDatasource, namespace is the datasource uid
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
