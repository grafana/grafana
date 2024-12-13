package secret

import (
	"encoding/json"
	"fmt"
	"strconv"

	"gopkg.in/yaml.v3"
)

const redacted = "[REDACTED]"

// ExposedSecureValue contains the raw decrypted secure value.
type ExposedSecureValue struct {
	_ struct{}  // noCopy
	_ [0]func() // noCompare

	v string
}

var (
	_ fmt.Stringer   = (*ExposedSecureValue)(nil)
	_ json.Marshaler = (*ExposedSecureValue)(nil)
	_ yaml.Marshaler = (*ExposedSecureValue)(nil)
)

// NewExposedSecureValue creates a new exposed secure value wrapper.
func NewExposedSecureValue(v string) ExposedSecureValue {
	return ExposedSecureValue{v: v}
}

// DangerouslyExposeDecryptedValue will return the decrypted secure value.
// The function name is intentionally kept long and weird because this is a dangerous operation and should be used carefully!
func (s ExposedSecureValue) DangerouslyExposeDecryptedValue() string {
	return s.v
}

// String must not return the exposed secure value.
func (s ExposedSecureValue) String() string {
	return redacted
}

// MarshalJSON must not return the exposed secure value.
func (s ExposedSecureValue) MarshalJSON() ([]byte, error) {
	return []byte(strconv.Quote(redacted)), nil
}

// MarshalYAML must not return the exposed secure value.
func (s ExposedSecureValue) MarshalYAML() (any, error) {
	return redacted, nil
}

// SecureValue
// TODO: what fields do we need for this DTO? We convert from the k8s object to this before entering the core logic.
type SecureValue struct {
	Title string
	Value ExposedSecureValue
}

// ManagedSecureValueID represents either the secure value's GUID or ref (in case of external secret references).
// TODO: maybe this should be an interface?
type ManagedSecureValueID string

func (s ManagedSecureValueID) String() string {
	return string(s)
}
