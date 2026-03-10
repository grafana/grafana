package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const OpenAPIPrefix = "com.github.grafana.grafana.pkg.apis.userstorage.v0alpha1."

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type UserStorage struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec UserStorageSpec `json:"spec,omitempty"`
}

func (UserStorage) OpenAPIModelName() string {
	return OpenAPIPrefix + "UserStorage"
}

type UserStorageSpec struct {
	// Data is the key:value stored in the user storage for a service.
	Data map[string]string `json:"data"`
}

func (UserStorageSpec) OpenAPIModelName() string {
	return OpenAPIPrefix + "UserStorageSpec"
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type UserStorageList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []UserStorage `json:"items"`
}

func (UserStorageList) OpenAPIModelName() string {
	return OpenAPIPrefix + "UserStorageList"
}
