// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetMetas struct {
	Items []V0alpha1GetMetasItems `json:"items"`
}

// NewGetMetas creates a new GetMetas object.
func NewGetMetas() *GetMetas {
	return &GetMetas{
		Items: []V0alpha1GetMetasItems{},
	}
}

// +k8s:openapi-gen=true
type V0alpha1GetMetasItems struct {
	Id   string `json:"id"`
	Type string `json:"type"`
	Name string `json:"name"`
}

// NewV0alpha1GetMetasItems creates a new V0alpha1GetMetasItems object.
func NewV0alpha1GetMetasItems() *V0alpha1GetMetasItems {
	return &V0alpha1GetMetasItems{}
}
