package live

import (
	"strings"
)

// ChannelAddress is the channel id split by parts
type ChannelAddress struct {
	Scope     string `json:"scope,omitempty"`     // grafana, ds, or plugin
	Namespace string `json:"namespace,omitempty"` // feature, id, or name
	Path      string `json:"path,omitempty"`      // path within the channel handler
}

// ParseChannelAddress parses the parts from a channel id:
//   ${scope} / ${namespace} / ${path}
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

// IsValid checks if all parts of the address are valid
func (ca *ChannelAddress) IsValid() bool {
	return ca.Scope != "" && ca.Namespace != "" && ca.Path != ""
}

// ToChannelID converts this to a single string
func (ca *ChannelAddress) ToChannelID() string {
	return ca.Scope + "/" + ca.Namespace + "/" + ca.Path
}
