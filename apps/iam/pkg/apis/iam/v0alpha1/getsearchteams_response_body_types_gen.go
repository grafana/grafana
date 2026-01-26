// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type VersionsV0alpha1RoutesNamespacedSearchTeamsGETResponseTeamHit struct {
	Name        string `json:"name"`
	Title       string `json:"title"`
	Email       string `json:"email"`
	Provisioned bool   `json:"provisioned"`
	ExternalUID string `json:"externalUID"`
}

// NewVersionsV0alpha1RoutesNamespacedSearchTeamsGETResponseTeamHit creates a new VersionsV0alpha1RoutesNamespacedSearchTeamsGETResponseTeamHit object.
func NewVersionsV0alpha1RoutesNamespacedSearchTeamsGETResponseTeamHit() *VersionsV0alpha1RoutesNamespacedSearchTeamsGETResponseTeamHit {
	return &VersionsV0alpha1RoutesNamespacedSearchTeamsGETResponseTeamHit{}
}

// +k8s:openapi-gen=true
type GetSearchTeamsBody struct {
	Offset    int64                                                           `json:"offset"`
	TotalHits int64                                                           `json:"totalHits"`
	Hits      []VersionsV0alpha1RoutesNamespacedSearchTeamsGETResponseTeamHit `json:"hits"`
	QueryCost float64                                                         `json:"queryCost"`
	MaxScore  float64                                                         `json:"maxScore"`
}

// NewGetSearchTeamsBody creates a new GetSearchTeamsBody object.
func NewGetSearchTeamsBody() *GetSearchTeamsBody {
	return &GetSearchTeamsBody{
		Hits: []VersionsV0alpha1RoutesNamespacedSearchTeamsGETResponseTeamHit{},
	}
}
