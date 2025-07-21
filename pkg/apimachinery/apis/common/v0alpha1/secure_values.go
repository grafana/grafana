package v0alpha1

import (
	"encoding/json"
	"fmt"
	"strconv"

	"gopkg.in/yaml.v3"
)

const redacted = "[REDACTED]"

// RawSecureValue contains the raw decrypted secure value.
type RawSecureValue string

var (
	_ fmt.Stringer   = (*RawSecureValue)(nil)
	_ fmt.Formatter  = (*RawSecureValue)(nil)
	_ fmt.GoStringer = (*RawSecureValue)(nil)
	_ json.Marshaler = (*RawSecureValue)(nil)
	_ yaml.Marshaler = (*RawSecureValue)(nil)
)

// Allow access to a secure value inside
// +k8s:openapi-gen=true
type InlineSecureValue struct {
	// Create a secure value -- this is only used for POST/PUT
	// +k8s:validation:minLength=1
	// +k8s:validation:maxLength=24576
	Create RawSecureValue `json:"create,omitempty"`

	// Name in the secret service (reference)
	Name string `json:"name,omitempty"`

	// Remove this value from the secure value map
	// Values owned by this resource will be deleted if necessary
	Remove bool `json:"remove,omitempty,omitzero"`
}

func (v InlineSecureValue) IsZero() bool {
	return v.Create.IsZero() && v.Name == "" && !v.Remove
}

// Collection of secure values
// +k8s:openapi-gen=true
type InlineSecureValues = map[string]InlineSecureValue

// NewSecretValue creates a new exposed secure value wrapper.
func NewSecretValue(v string) RawSecureValue {
	return RawSecureValue(v)
}

// DangerouslyExposeAndConsumeValue will move the decrypted secure value out of the wrapper and return it.
// Further attempts to call this method will panic.
// The function name is intentionally kept long and weird because this is a dangerous operation and should be used carefully!
func (s *RawSecureValue) DangerouslyExposeAndConsumeValue() string {
	if *s == "" {
		panic("underlying value is empty or was consumed")
	}

	tmp := *s
	*s = ""

	return string(tmp)
}

func (s RawSecureValue) IsZero() bool {
	return s == "" // exclude from JSON
}

// String must not return the exposed secure value.
func (s RawSecureValue) String() string {
	return redacted
}

// Format must not return the exposed secure value.
func (s RawSecureValue) Format(f fmt.State, _verb rune) {
	_, _ = fmt.Fprint(f, redacted)
}

// GoString must not return the exposed secure value.
func (s RawSecureValue) GoString() string {
	return redacted
}

// MarshalJSON must not return the exposed secure value.
func (s RawSecureValue) MarshalJSON() ([]byte, error) {
	return []byte(strconv.Quote(redacted)), nil
}

// MarshalYAML must not return the exposed secure value.
func (s RawSecureValue) MarshalYAML() (any, error) {
	return redacted, nil
}
