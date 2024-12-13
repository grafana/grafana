package v0alpha1

import (
	"encoding/json"
	"fmt"
	"strconv"

	"gopkg.in/yaml.v3"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type SecureValue struct {
	metav1.TypeMeta `json:",inline"`

	// Standard object's metadata. It can only be one of `metav1.ObjectMeta` or `metav1.ListMeta`.
	// More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
	// +optional
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// This is the actual secure value schema.
	Spec SecureValueSpec `json:"spec,omitempty"`
}

const redacted = "[REDACTED]"

// ExposedSecureValue contains the raw decrypted secure value.
type ExposedSecureValue string

var (
	_ fmt.Stringer   = (*ExposedSecureValue)(nil)
	_ fmt.Formatter  = (*ExposedSecureValue)(nil)
	_ fmt.GoStringer = (*ExposedSecureValue)(nil)
	_ json.Marshaler = (*ExposedSecureValue)(nil)
	_ yaml.Marshaler = (*ExposedSecureValue)(nil)
)

// DangerouslyExposeDecryptedValue will return the decrypted secure value.
// The function name is intentionally kept long and weird because this is a dangerous operation and should be used carefully!
func (s *ExposedSecureValue) DangerouslyExposeDecryptedValue() string {
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

type SecureValueSpec struct {
	// Human friendly name for the secure value.
	Title string `json:"title"`

	// The raw value is only valid for write. Read/List will always be empty
	// Writing with an empty value will always fail
	Value ExposedSecureValue `json:"value,omitempty"`

	// When using a remote Key manager, the ref is used to
	// reference a value inside the remote storage
	// This value is only expected on write.
	Ref string `json:"ref,omitempty"`

	// Name of the keeper, being the actual storage of the secure value.
	Keeper string `json:"keeper,omitempty"`

	// The Audiences that are allowed to decrypt this secret
	// Support and behavior is still TBD, but could likely look like:
	// * testdata.grafana.app/{name1}
	// * testdata.grafana.app/{name2}
	// * runner.k6.grafana.app/*  -- allow any k6 test runner
	// Rather than a string pattern, we may want a more explicit object:
	// [{ group:"testdata.grafana.app", name="name1"},
	//  { group:"runner.k6.grafana.app"}]
	// +listType=atomic
	// TODO: look into making this a set
	Audiences []string `json:"audiences"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type SecureValueList struct {
	metav1.TypeMeta `json:",inline"`

	// Standard list's metadata. It can only be one of `metav1.ObjectMeta` or `metav1.ListMeta`.
	// More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
	// +optional
	metav1.ListMeta `json:"metadata,omitempty"`

	// Slice containing all secure values. This will NOT output decrypted values.
	Items []SecureValue `json:"items,omitempty"`
}
