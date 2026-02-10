// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetSearchUsersUserHit struct {
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

// NewGetSearchUsersUserHit creates a new GetSearchUsersUserHit object.
func NewGetSearchUsersUserHit() *GetSearchUsersUserHit {
	return &GetSearchUsersUserHit{}
}

// +k8s:openapi-gen=true
type GetSearchUsersResponse struct {
	Offset    int64                   `json:"offset"`
	TotalHits int64                   `json:"totalHits"`
	Hits      []GetSearchUsersUserHit `json:"hits"`
	QueryCost float64                 `json:"queryCost"`
	MaxScore  float64                 `json:"maxScore"`
}

// NewGetSearchUsersResponse creates a new GetSearchUsersResponse object.
func NewGetSearchUsersResponse() *GetSearchUsersResponse {
	return &GetSearchUsersResponse{
		Hits: []GetSearchUsersUserHit{},
	}
}
func (GetSearchUsersUserHit) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetSearchUsersUserHit"
}
func (GetSearchUsersResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetSearchUsersResponse"
}
