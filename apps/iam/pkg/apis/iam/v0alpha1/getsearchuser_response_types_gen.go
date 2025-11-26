// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type UserHit struct {
	Name     string  `json:"name"`
	Username string  `json:"username"`
	Email    string  `json:"email"`
	Title    string  `json:"title"`
	Score    float64 `json:"score"`
}

// NewUserHit creates a new UserHit object.
func NewUserHit() *UserHit {
	return &UserHit{}
}

// +k8s:openapi-gen=true
type GetSearchUser struct {
	Offset    int64     `json:"offset"`
	TotalHits int64     `json:"totalHits"`
	Hits      []UserHit `json:"hits"`
	QueryCost float64   `json:"queryCost"`
	MaxScore  float64   `json:"maxScore"`
}

// NewGetSearchUser creates a new GetSearchUser object.
func NewGetSearchUser() *GetSearchUser {
	return &GetSearchUser{
		Hits: []UserHit{},
	}
}
