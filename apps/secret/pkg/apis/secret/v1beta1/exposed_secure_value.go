//
// THIS FILE IS MANUALLY GENERATED TO OVERCOME LIMITATIONS WITH CUE. FEEL FREE TO EDIT IT.
//

package v1beta1

import (
	"encoding/json"
	"fmt"
	"strconv"

	"gopkg.in/yaml.v3"
)

const redacted = "[REDACTED]"

// ExposedSecureValue contains the raw decrypted secure value.
type ExposedSecureValue = SecureValueExposedSecureValue

var (
	_ fmt.Stringer   = (*ExposedSecureValue)(nil)
	_ fmt.Formatter  = (*ExposedSecureValue)(nil)
	_ fmt.GoStringer = (*ExposedSecureValue)(nil)
	_ json.Marshaler = (*ExposedSecureValue)(nil)
	_ yaml.Marshaler = (*ExposedSecureValue)(nil)
)

// NewExposedSecureValue creates a new exposed secure value wrapper.
func NewExposedSecureValue(v string) ExposedSecureValue {
	return ExposedSecureValue(v)
}

// DangerouslyExposeAndConsumeValue will move the decrypted secure value out of the wrapper and return it.
// Further attempts to call this method will panic.
// The function name is intentionally kept long and weird because this is a dangerous operation and should be used carefully!
func (s *ExposedSecureValue) DangerouslyExposeAndConsumeValue() string {
	if *s == "" {
		panic("underlying value is empty or was consumed")
	}

	tmp := *s
	*s = ""

	return string(tmp)
}

// String must not return the exposed secure value.
func (s ExposedSecureValue) String() string {
	return redacted
}

// Format must not return the exposed secure value.
func (s ExposedSecureValue) Format(f fmt.State, _verb rune) {
	_, _ = fmt.Fprint(f, redacted)
}

// GoString must not return the exposed secure value.
func (s ExposedSecureValue) GoString() string {
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
