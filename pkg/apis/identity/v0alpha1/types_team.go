package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type Team struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec TeamSpec `json:"spec,omitempty"`
}

type TeamSpec struct {
	Title string `json:"name,omitempty"`
	Email string `json:"email,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type TeamList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []Team `json:"items,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type TeamBinding struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec TeamBindingSpec `json:"spec,omitempty"`
}

type TeamBindingSpec struct {
	Subjects []TeamSubject `json:"subjects,omitempty"`
	TeamRef  TeamRef       `json:"teamRef,omitempty"`
}

type TeamSubject struct {
	// Kind is the kind of the subject, only supports "User".
	Kind string `json:"kind,omitempty"`

	// Name is the unique identifier for subject.
	Name string `json:"name,omitempty"`
}

type TeamRef struct {
	// Name is the unique identifier for a team.
	Name string `json:"name,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type TeamBindingList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []TeamBinding `json:"items,omitempty"`
}
