package live

import (
	"strings"
)

// Channel is the channel ID split by parts.
type Channel struct {
	// Scope is one of available channel scopes:
	// like ScopeGrafana, ScopePlugin, ScopeDatasource, ScopeStream.
	Scope string `json:"scope,omitempty"`

	// Namespace meaning depends on the scope.
	// * when ScopeGrafana, namespace is a "feature"
	// * when ScopePlugin, namespace is the plugin name
	// * when ScopeDatasource, namespace is the datasource uid
	// * when ScopeStream, namespace is the stream ID.
	Namespace string `json:"namespace,omitempty"`

	// Within each namespace, the handler can process the path as needed.
	Path string `json:"path,omitempty"`
}

// ParseChannel parses the parts from a channel ID:
//   ${scope} / ${namespace} / ${path}.
func ParseChannel(chID string) Channel {
	addr := Channel{}
	parts := strings.SplitN(chID, "/", 3)
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

func (c Channel) String() string {
	ch := c.Scope
	if c.Namespace != "" {
		ch += "/" + c.Namespace
	}
	if c.Path != "" {
		ch += "/" + c.Path
	}
	return ch
}

// IsValid checks if all parts of the address are valid.
func (c *Channel) IsValid() bool {
	if c.Scope == ScopePush {
		// Push scope channels supposed to be like push/{$stream_id}.
		return c.Namespace != "" && c.Path == ""
	}
	return c.Scope != "" && c.Namespace != "" && c.Path != ""
}
