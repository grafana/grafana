package teamapi

import (
	"encoding/json"
	"net/http"
	"strconv"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/team"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
)

func (tapi *TeamAPI) searchTeamsViaK8s(c *contextmodel.ReqContext, page, perPage int) response.Response {
	ctx := c.Req.Context()
	ctx, span := tracer.Start(ctx, "searchTeamsViaK8s")
	defer span.End()

	namespace := c.Namespace

	cfg := tapi.clientConfigProvider.GetDirectRestConfig(c)
	if cfg == nil {
		return response.Error(http.StatusInternalServerError, "REST config not available", nil)
	}
	cfg = dynamic.ConfigFor(cfg)
	cfg.GroupVersion = &iamv0alpha1.GroupVersion
	restClient, err := rest.RESTClientFor(cfg)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to create REST client", err)
	}

	req := restClient.Get().
		AbsPath("apis", iamv0alpha1.APIGroup, iamv0alpha1.APIVersion, "namespaces", namespace, "searchTeams").
		Param("accesscontrol", "true")

	if query := c.Query("query"); query != "" {
		req = req.Param("query", query)
	}
	if perPage > 0 {
		req = req.Param("limit", strconv.Itoa(perPage))
	}
	if page > 0 {
		req = req.Param("page", strconv.Itoa(page))
	}

	result := req.Do(ctx)
	if err := result.Error(); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to search Teams", err)
	}

	body, _ := result.Raw() // err has already been checked

	var searchResp iamv0alpha1.GetSearchTeamsResponse
	if err := json.Unmarshal(body, &searchResp); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to parse search response", err)
	}

	teams := make([]*team.TeamDTO, 0, len(searchResp.Hits))
	for _, hit := range searchResp.Hits {
		teams = append(teams, &team.TeamDTO{
			UID:           hit.Name,
			OrgID:         c.GetOrgID(),
			Name:          hit.Title,
			Email:         hit.Email,
			AvatarURL:     dtos.GetGravatarUrlWithDefault(tapi.cfg, hit.Email, hit.Title),
			IsProvisioned: hit.Provisioned,
			ExternalUID:   hit.ExternalUID,
			AccessControl: hit.AccessControl,
		})
	}

	return response.JSON(http.StatusOK, team.SearchTeamQueryResult{
		TotalCount: searchResp.TotalHits,
		Teams:      teams,
		Page:       page,
		PerPage:    perPage,
	})
}
