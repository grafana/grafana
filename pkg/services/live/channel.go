package live

import (
	"fmt"
	"strings"
)

// ChannelIdentifier is the channel id split by parts
type ChannelIdentifier struct {
	Scope     string // grafana, ds, or plugin
	Namespace string // feature, id, or name
	Path      string // path within the channel handler
}

// ParseChannelIdentifier parses the parts from a channel id:
//   ${scope} / ${namespace} / ${path}
func ParseChannelIdentifier(id string) (ChannelIdentifier, error) {
	parts := strings.SplitN(id, "/", 3)
	if len(parts) == 3 {
		return ChannelIdentifier{
			Scope:     parts[0],
			Namespace: parts[1],
			Path:      parts[2],
		}, nil
	}
	return ChannelIdentifier{}, fmt.Errorf("Invalid channel id: %s", id)
}
