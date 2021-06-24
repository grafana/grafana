package managedstream

import (
	"encoding/json"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// FrameCache allows updating frame schema. Returns true is schema not changed.
type FrameCache interface {
	// GetActiveChannels returns active managed stream channels with JSON schema.
	GetActiveChannels(orgID int64) (map[string]json.RawMessage, error)
	// GetFrame returns full JSON frame for a path.
	GetFrame(orgID int64, channel string) (json.RawMessage, bool, error)
	// Update updates frame cache and returns true if schema changed.
	Update(orgID int64, channel string, frameJson data.FrameJSONCache) (bool, error)
}
