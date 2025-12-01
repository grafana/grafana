package crdt

import (
	"encoding/json"
)

// LWWRegister represents a Last-Write-Wins Register CRDT
type LWWRegister struct {
	value     interface{}
	timestamp HLCTimestamp
}

// LWWRegisterJSON is the JSON representation of LWWRegister
type LWWRegisterJSON struct {
	Value     interface{}  `json:"value"`
	Timestamp HLCTimestamp `json:"timestamp"`
}

// NewLWWRegister creates a new LWW-Register with an initial value and timestamp
func NewLWWRegister(value interface{}, timestamp HLCTimestamp) *LWWRegister {
	return &LWWRegister{
		value:     value,
		timestamp: timestamp,
	}
}

// Set sets the register value if the new timestamp is greater than current
// Returns true if the value was updated, false if update was ignored
func (r *LWWRegister) Set(value interface{}, timestamp HLCTimestamp) bool {
	// Only update if new timestamp is strictly greater
	if CompareHLC(timestamp, r.timestamp) > 0 {
		r.value = value
		r.timestamp = timestamp
		return true
	}
	return false
}

// Get returns the current value
func (r *LWWRegister) Get() interface{} {
	return r.value
}

// GetTimestamp returns the current timestamp
func (r *LWWRegister) GetTimestamp() HLCTimestamp {
	return r.timestamp
}

// Merge merges another LWW-Register into this one
// Keeps the value with the highest timestamp
// Returns true if this register's value was updated
func (r *LWWRegister) Merge(other *LWWRegister) bool {
	return r.Set(other.value, other.timestamp)
}

// Clone creates a copy of the register
func (r *LWWRegister) Clone() *LWWRegister {
	return &LWWRegister{
		value:     r.value,
		timestamp: r.timestamp,
	}
}

// MarshalJSON implements json.Marshaler
func (r *LWWRegister) MarshalJSON() ([]byte, error) {
	return json.Marshal(LWWRegisterJSON{
		Value:     r.value,
		Timestamp: r.timestamp,
	})
}

// UnmarshalJSON implements json.Unmarshaler
func (r *LWWRegister) UnmarshalJSON(data []byte) error {
	var tmp LWWRegisterJSON
	if err := json.Unmarshal(data, &tmp); err != nil {
		return err
	}

	r.value = tmp.Value
	r.timestamp = tmp.Timestamp
	return nil
}
