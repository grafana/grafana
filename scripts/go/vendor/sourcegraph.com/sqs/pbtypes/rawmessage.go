package pbtypes

import "errors"

// RawMessage is a raw encoded JSON object.
// It implements json.Marshaler and json.Unmarshaler like json.RawMessage,
// but also proto.Marshaler and proto.Unmarshaler.
type RawMessage []byte

// MarshalJSON returns *m as the JSON encoding of m.
func (m *RawMessage) MarshalJSON() ([]byte, error) {
	return *m, nil
}

// UnmarshalJSON sets *m to a copy of data.
func (m *RawMessage) UnmarshalJSON(data []byte) error {
	if m == nil {
		return errors.New("pbtypes.RawMessage: UnmarshalJSON on nil pointer")
	}
	*m = append((*m)[0:0], data...)
	return nil
}

// Marshal implements proto.Marshaler.
func (m *RawMessage) Marshal() ([]byte, error) {
	return *m, nil
}

// Unmarshal implements proto.Unmarshaler.
func (m *RawMessage) Unmarshal(data []byte) error {
	if m == nil {
		return errors.New("pbtypes.RawMessage: Unmarshal on nil pointer")
	}
	*m = append((*m)[0:0], data...)
	return nil
}
