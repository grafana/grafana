package v0alpha1

import (
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

	// Read-only observed status of the `SecureValue`.
	// More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status
	Status SecureValueStatus `json:"status"`
}

// +enum
type SecureValuePhase string

const (
	// When the `SecureValue` is created, it will start in `Pending` phase to create the underlying secret asynchronously.
	SecureValuePhasePending SecureValuePhase = "Pending"

	// If the creation of the secret is successful, it will move to the `Succeeded` phase.
	SecureValuePhaseSucceeded SecureValuePhase = "Succeeded"

	// If the creation of the secret fails, it will move to the `Failed` phase.
	// Check the additional `status` fields for more information on what caused the failure.
	// This state is unrecoverable.
	SecureValuePhaseFailed SecureValuePhase = "Failed"
)

type SecureValueStatus struct {
	// High-level summary of where the `SecureValue` is in its lifecycle.
	// One of: `Pending`, `Succeeded` or `Failed`.
	Phase SecureValuePhase `json:"phase"`

	// A human readable message indicating details about why the `SecureValue` is in this phase.
	// Only applicable if the `phase=Failed`.
	// +optional
	Message string `json:"message,omitempty"`
}

type SecureValueSpec struct {
	// Human friendly name for the secure value.
	Title string `json:"title"`

	// The raw value is only valid for write. Read/List will always be empty.
	// There is no support for mixing `value` and `ref`, you can't create a secret in a third-party keeper with a specified `ref`.
	Value ExposedSecureValue `json:"value,omitempty"`

	// When using a remote Key manager, the ref is used to reference a value inside the remote storage.
	// This should not contain sensitive information.
	Ref string `json:"ref,omitempty"`

	// Name of the keeper, being the actual storage of the secure value.
	Keeper string `json:"keeper,omitempty"`

	// The Decrypters that are allowed to decrypt this secret.
	// An empty list means no service can decrypt it.
	// Support and behavior is still TBD, but could likely look like:
	// * testdata.grafana.app/{name1}
	// * testdata.grafana.app/{name2}
	// * runner.k6.grafana.app/*  -- allow any k6 test runner
	// Rather than a string pattern, we may want a more explicit object:
	// [{ group:"testdata.grafana.app", name="name1"},
	//  { group:"runner.k6.grafana.app"}]
	// +listType=atomic
	// +optional
	Decrypters []string `json:"decrypters"`
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
