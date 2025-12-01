package crdt

import (
	"encoding/json"
)

// PNCounter represents a Positive-Negative Counter CRDT
type PNCounter struct {
	increments map[string]int64 // nodeId -> count
	decrements map[string]int64 // nodeId -> count
}

// PNCounterJSON is the JSON representation of PNCounter
type PNCounterJSON struct {
	Increments map[string]int64 `json:"increments"`
	Decrements map[string]int64 `json:"decrements"`
}

// NewPNCounter creates a new PN-Counter
func NewPNCounter() *PNCounter {
	return &PNCounter{
		increments: make(map[string]int64),
		decrements: make(map[string]int64),
	}
}

// Increment increments the counter for a specific node
func (c *PNCounter) Increment(nodeID string, delta int64) {
	if delta < 0 {
		panic("delta must be non-negative for increment")
	}
	c.increments[nodeID] += delta
}

// Decrement decrements the counter for a specific node
func (c *PNCounter) Decrement(nodeID string, delta int64) {
	if delta < 0 {
		panic("delta must be non-negative for decrement")
	}
	c.decrements[nodeID] += delta
}

// Value returns the current value of the counter
// Value = sum of all increments - sum of all decrements
func (c *PNCounter) Value() int64 {
	var sum int64 = 0

	// Add all increments
	for _, count := range c.increments {
		sum += count
	}

	// Subtract all decrements
	for _, count := range c.decrements {
		sum -= count
	}

	return sum
}

// Next gets the next value and increments the counter for a node
// This is useful for allocating sequential IDs (like z-indices)
func (c *PNCounter) Next(nodeID string) int64 {
	nextValue := c.Value() + 1
	c.Increment(nodeID, 1)
	return nextValue
}

// Merge merges another PN-Counter into this one
// Takes the maximum value for each node's counters
func (c *PNCounter) Merge(other *PNCounter) {
	// Merge increments (take max for each node)
	for nodeID, count := range other.increments {
		if current, exists := c.increments[nodeID]; !exists || count > current {
			c.increments[nodeID] = count
		}
	}

	// Merge decrements (take max for each node)
	for nodeID, count := range other.decrements {
		if current, exists := c.decrements[nodeID]; !exists || count > current {
			c.decrements[nodeID] = count
		}
	}
}

// Clone creates a copy of the counter
func (c *PNCounter) Clone() *PNCounter {
	clone := NewPNCounter()

	for nodeID, count := range c.increments {
		clone.increments[nodeID] = count
	}

	for nodeID, count := range c.decrements {
		clone.decrements[nodeID] = count
	}

	return clone
}

// Reset resets the counter to zero
func (c *PNCounter) Reset() {
	c.increments = make(map[string]int64)
	c.decrements = make(map[string]int64)
}

// MarshalJSON implements json.Marshaler
func (c *PNCounter) MarshalJSON() ([]byte, error) {
	return json.Marshal(PNCounterJSON{
		Increments: c.increments,
		Decrements: c.decrements,
	})
}

// UnmarshalJSON implements json.Unmarshaler
func (c *PNCounter) UnmarshalJSON(data []byte) error {
	var tmp PNCounterJSON
	if err := json.Unmarshal(data, &tmp); err != nil {
		return err
	}

	c.increments = tmp.Increments
	if c.increments == nil {
		c.increments = make(map[string]int64)
	}

	c.decrements = tmp.Decrements
	if c.decrements == nil {
		c.decrements = make(map[string]int64)
	}

	return nil
}
