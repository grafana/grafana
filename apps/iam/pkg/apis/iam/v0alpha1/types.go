package v0alpha1

import metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

// CreateTokenRequestBody is the request body for POST /tokens.
type CreateTokenRequestBody struct {
	TokenName        string `json:"tokenName"`
	ExpiresInSeconds int64  `json:"expiresInSeconds"`
}

// +k8s:deepcopy-gen=true
type CreateTokenBody struct {
	Token                   string `json:"token"`
	ServiceAccountTokenName string `json:"serviceAccountTokenName"`
	Expires                 int64  `json:"expires"` // unix seconds; 0 means never expires
}

// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type CreateSATokenResponse struct {
	metav1.TypeMeta `json:",inline"`
	CreateTokenBody `json:",inline"`
}

// +k8s:deepcopy-gen=true
type TokenItem struct {
	Title    string `json:"title"`
	Revoked  bool   `json:"revoked"`
	Expires  int64  `json:"expires"`  // unix seconds; 0 means never expires
	Created  int64  `json:"created"`  // unix seconds
	Updated  int64  `json:"updated"`  // unix seconds
	LastUsed int64  `json:"lastUsed"` // unix seconds; 0 means never used
}

// +k8s:deepcopy-gen=true
type ListTokensBody struct {
	Items    []TokenItem `json:"items"`
	Continue string      `json:"continue,omitempty"`
}

// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ListSATokenResponse struct {
	metav1.TypeMeta `json:",inline"`
	ListTokensBody  `json:",inline"`
}

// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type SATokenResponse struct {
	metav1.TypeMeta `json:",inline"`
	TokenItem       `json:",inline"`
}

// +k8s:deepcopy-gen=true
type DeleteTokenBody struct {
	Message string `json:"message"`
}

// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DeleteSATokenResponse struct {
	metav1.TypeMeta `json:",inline"`
	DeleteTokenBody `json:",inline"`
}
