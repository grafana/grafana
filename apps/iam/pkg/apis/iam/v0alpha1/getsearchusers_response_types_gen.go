// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type UserHit struct {
	Name          string  `json:"name"`
	Title         string  `json:"title"`
	Login         string  `json:"login"`
	Email         string  `json:"email"`
	Role          string  `json:"role"`
	LastSeenAt    int64   `json:"lastSeenAt"`
	LastSeenAtAge string  `json:"lastSeenAtAge"`
	Provisioned   bool    `json:"provisioned"`
	Score         float64 `json:"score"`
}

// NewUserHit creates a new UserHit object.
func NewUserHit() *UserHit {
	return &UserHit{}
}

// +k8s:openapi-gen=true
type GetSearchUsers struct {
	Offset    int64     `json:"offset"`
	TotalHits int64     `json:"totalHits"`
	Hits      []UserHit `json:"hits"`
	QueryCost float64   `json:"queryCost"`
	MaxScore  float64   `json:"maxScore"`
}

// NewGetSearchUsers creates a new GetSearchUsers object.
func NewGetSearchUsers() *GetSearchUsers {
	return &GetSearchUsers{
		Hits: []UserHit{},
	}
}
