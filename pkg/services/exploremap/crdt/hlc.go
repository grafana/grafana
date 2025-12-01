package crdt

import (
	"encoding/json"
	"time"
)

// HLCTimestamp represents a hybrid logical clock timestamp
type HLCTimestamp struct {
	LogicalTime int64  `json:"logicalTime"`
	WallTime    int64  `json:"wallTime"` // milliseconds since epoch
	NodeID      string `json:"nodeId"`
}

// HybridLogicalClock manages hybrid logical time for a node
type HybridLogicalClock struct {
	logicalTime  int64
	lastWallTime int64
	nodeID       string
}

// NewHybridLogicalClock creates a new HLC with the given node ID
func NewHybridLogicalClock(nodeID string) *HybridLogicalClock {
	return &HybridLogicalClock{
		logicalTime:  0,
		lastWallTime: time.Now().UnixMilli(),
		nodeID:       nodeID,
	}
}

// Tick advances the clock for a local event and returns a new timestamp
func (h *HybridLogicalClock) Tick() HLCTimestamp {
	now := time.Now().UnixMilli()

	if now > h.lastWallTime {
		// Physical clock advanced - use it
		h.lastWallTime = now
		h.logicalTime = 0
	} else {
		// Physical clock hasn't advanced - increment logical component
		h.logicalTime++
	}

	return h.Clone()
}

// Update updates the clock based on a received timestamp from another node
func (h *HybridLogicalClock) Update(received HLCTimestamp) {
	now := time.Now().UnixMilli()
	maxWall := max(h.lastWallTime, received.WallTime, now)

	if maxWall == h.lastWallTime && maxWall == received.WallTime {
		// Same wall time - take max logical time and increment
		h.logicalTime = max(h.logicalTime, received.LogicalTime, 0) + 1
	} else if maxWall == received.WallTime {
		// Received timestamp has newer wall time
		h.lastWallTime = maxWall
		h.logicalTime = received.LogicalTime + 1
	} else {
		// Our wall time or physical clock is newer
		h.lastWallTime = maxWall
		h.logicalTime = 0
	}
}

// Clone returns a copy of the current timestamp
func (h *HybridLogicalClock) Clone() HLCTimestamp {
	return HLCTimestamp{
		LogicalTime: h.logicalTime,
		WallTime:    h.lastWallTime,
		NodeID:      h.nodeID,
	}
}

// Now returns the current timestamp without advancing the clock
func (h *HybridLogicalClock) Now() HLCTimestamp {
	return h.Clone()
}

// GetNodeID returns the node ID
func (h *HybridLogicalClock) GetNodeID() string {
	return h.nodeID
}

// CompareHLC compares two HLC timestamps
// Returns: -1 if a < b, 0 if a == b, 1 if a > b
func CompareHLC(a, b HLCTimestamp) int {
	// First compare wall time
	if a.WallTime != b.WallTime {
		if a.WallTime < b.WallTime {
			return -1
		}
		return 1
	}

	// Then compare logical time
	if a.LogicalTime != b.LogicalTime {
		if a.LogicalTime < b.LogicalTime {
			return -1
		}
		return 1
	}

	// Finally compare node IDs for deterministic tie-breaking
	if a.NodeID < b.NodeID {
		return -1
	} else if a.NodeID > b.NodeID {
		return 1
	}

	return 0
}

// HappensBefore checks if timestamp a happened before timestamp b
func HappensBefore(a, b HLCTimestamp) bool {
	return CompareHLC(a, b) < 0
}

// HappensAfter checks if timestamp a happened after timestamp b
func HappensAfter(a, b HLCTimestamp) bool {
	return CompareHLC(a, b) > 0
}

// TimestampEquals checks if two timestamps are equal
func TimestampEquals(a, b HLCTimestamp) bool {
	return CompareHLC(a, b) == 0
}

// MaxTimestamp returns the later of two timestamps
func MaxTimestamp(a, b HLCTimestamp) HLCTimestamp {
	if CompareHLC(a, b) >= 0 {
		return a
	}
	return b
}

// MarshalJSON implements json.Marshaler
func (t HLCTimestamp) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		LogicalTime int64  `json:"logicalTime"`
		WallTime    int64  `json:"wallTime"`
		NodeID      string `json:"nodeId"`
	}{
		LogicalTime: t.LogicalTime,
		WallTime:    t.WallTime,
		NodeID:      t.NodeID,
	})
}

// UnmarshalJSON implements json.Unmarshaler
func (t *HLCTimestamp) UnmarshalJSON(data []byte) error {
	var tmp struct {
		LogicalTime int64  `json:"logicalTime"`
		WallTime    int64  `json:"wallTime"`
		NodeID      string `json:"nodeId"`
	}

	if err := json.Unmarshal(data, &tmp); err != nil {
		return err
	}

	t.LogicalTime = tmp.LogicalTime
	t.WallTime = tmp.WallTime
	t.NodeID = tmp.NodeID
	return nil
}

func max(a, b, c int64) int64 {
	result := a
	if b > result {
		result = b
	}
	if c > result {
		result = c
	}
	return result
}
