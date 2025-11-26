// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type VersionsV0alpha1Kinds7RoutesSearchGETResponseTeamHit struct {
	Name        string `json:"name"`
	Title       string `json:"title"`
	Email       string `json:"email"`
	Provisioned bool   `json:"provisioned"`
	ExternalUID string `json:"externalUID"`
}

// NewVersionsV0alpha1Kinds7RoutesSearchGETResponseTeamHit creates a new VersionsV0alpha1Kinds7RoutesSearchGETResponseTeamHit object.
func NewVersionsV0alpha1Kinds7RoutesSearchGETResponseTeamHit() *VersionsV0alpha1Kinds7RoutesSearchGETResponseTeamHit {
	return &VersionsV0alpha1Kinds7RoutesSearchGETResponseTeamHit{}
}

// +k8s:openapi-gen=true
type GetSearchBody struct {
	Offset    int64                                                  `json:"offset"`
	TotalHits int64                                                  `json:"totalHits"`
	Hits      []VersionsV0alpha1Kinds7RoutesSearchGETResponseTeamHit `json:"hits"`
	QueryCost float64                                                `json:"queryCost"`
	MaxScore  float64                                                `json:"maxScore"`
}

// NewGetSearchBody creates a new GetSearchBody object.
func NewGetSearchBody() *GetSearchBody {
	return &GetSearchBody{
		Hits: []VersionsV0alpha1Kinds7RoutesSearchGETResponseTeamHit{},
	}
}
