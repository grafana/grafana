// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetSearchTeamsTeamHit struct {
	Name        string `json:"name"`
	Title       string `json:"title"`
	Email       string `json:"email"`
	Provisioned bool   `json:"provisioned"`
	ExternalUID string `json:"externalUID"`
}

// NewGetSearchTeamsTeamHit creates a new GetSearchTeamsTeamHit object.
func NewGetSearchTeamsTeamHit() *GetSearchTeamsTeamHit {
	return &GetSearchTeamsTeamHit{}
}

// +k8s:openapi-gen=true
type GetSearchTeamsBody struct {
	Offset    int64                   `json:"offset"`
	TotalHits int64                   `json:"totalHits"`
	Hits      []GetSearchTeamsTeamHit `json:"hits"`
	QueryCost float64                 `json:"queryCost"`
	MaxScore  float64                 `json:"maxScore"`
}

// NewGetSearchTeamsBody creates a new GetSearchTeamsBody object.
func NewGetSearchTeamsBody() *GetSearchTeamsBody {
	return &GetSearchTeamsBody{
		Hits: []GetSearchTeamsTeamHit{},
	}
}
func (GetSearchTeamsTeamHit) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetSearchTeamsTeamHit"
}
func (GetSearchTeamsBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetSearchTeamsBody"
}
