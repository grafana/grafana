package v0alpha1

import (
	"encoding/json"
	"fmt"
	"strconv"

	"gopkg.in/yaml.v3"
)

const redacted = "[REDACTED]"

// RawSecretValue contains the raw decrypted secure value.
type RawSecretValue string

var (
	_ fmt.Stringer   = (*RawSecretValue)(nil)
	_ fmt.Formatter  = (*RawSecretValue)(nil)
	_ fmt.GoStringer = (*RawSecretValue)(nil)
	_ json.Marshaler = (*RawSecretValue)(nil)
	_ yaml.Marshaler = (*RawSecretValue)(nil)
)

// Access secure values inside any resource
// +k8s:openapi-gen=true
type InlineSecureValue struct {
	// Create a secure value -- this is only used for POST/PUT
	// +k8s:validation:minLength=1
	// +k8s:validation:maxLength=24576
	Create RawSecretValue `json:"create,omitempty"`

	// Name in the secret service (reference)
	Name string `json:"name,omitempty"`

	// Remove this value -- cascading delete to the secret service if necessary
	Remove bool `json:"remove,omitempty,omitzero"`
}

func (v InlineSecureValue) IsZero() bool {
	return v.Create.IsZero() && v.Name == "" && !v.Remove
}

// Collection of secure values
// +k8s:openapi-gen=true
type InlineSecureValues = map[string]InlineSecureValue

// NewSecretValue creates a new exposed secure value wrapper.
func NewSecretValue(v string) RawSecretValue {
	return RawSecretValue(v)
}

// DangerouslyExposeAndConsumeValue will move the decrypted secure value out of the wrapper and return it.
// Further attempts to call this method will panic.
// The function name is intentionally kept long and weird because this is a dangerous operation and should be used carefully!
func (s *RawSecretValue) DangerouslyExposeAndConsumeValue() string {
	if *s == "" {
		panic("underlying value is empty or was consumed")
	}

	tmp := *s
	*s = ""

	return string(tmp)
}

func (s RawSecretValue) IsZero() bool {
	return s == "" // exclude from JSON
}

// String must not return the exposed secure value.
func (s RawSecretValue) String() string {
	return redacted
}

// Format must not return the exposed secure value.
func (s RawSecretValue) Format(f fmt.State, _verb rune) {
	_, _ = fmt.Fprint(f, redacted)
}

// GoString must not return the exposed secure value.
func (s RawSecretValue) GoString() string {
	return redacted
}

// MarshalJSON must not return the exposed secure value.
func (s RawSecretValue) MarshalJSON() ([]byte, error) {
	return []byte(strconv.Quote(redacted)), nil
}

// MarshalYAML must not return the exposed secure value.
func (s RawSecretValue) MarshalYAML() (any, error) {
	return redacted, nil
}
