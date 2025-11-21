// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// response schema
// +k8s:openapi-gen=true
type VersionsV0alpha1Kinds7RoutesTeamsSearchGETResponseTeamHit struct {
	Name        string `json:"name"`
	Title       string `json:"title"`
	Email       string `json:"email"`
	Provisioned bool   `json:"provisioned"`
	ExternalUID string `json:"externalUID"`
}

// NewVersionsV0alpha1Kinds7RoutesTeamsSearchGETResponseTeamHit creates a new VersionsV0alpha1Kinds7RoutesTeamsSearchGETResponseTeamHit object.
func NewVersionsV0alpha1Kinds7RoutesTeamsSearchGETResponseTeamHit() *VersionsV0alpha1Kinds7RoutesTeamsSearchGETResponseTeamHit {
	return &VersionsV0alpha1Kinds7RoutesTeamsSearchGETResponseTeamHit{}
}

// +k8s:openapi-gen=true
type GetTeamssearchBody struct {
	Offset    int64                                                       `json:"offset"`
	TotalHits int64                                                       `json:"totalHits"`
	Hits      []VersionsV0alpha1Kinds7RoutesTeamsSearchGETResponseTeamHit `json:"hits"`
	QueryCost float64                                                     `json:"queryCost"`
	MaxScore  float64                                                     `json:"maxScore"`
}

// NewGetTeamssearchBody creates a new GetTeamssearchBody object.
func NewGetTeamssearchBody() *GetTeamssearchBody {
	return &GetTeamssearchBody{
		Hits: []VersionsV0alpha1Kinds7RoutesTeamsSearchGETResponseTeamHit{},
	}
}
