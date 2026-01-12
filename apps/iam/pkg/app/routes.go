package app

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

// GetTeamsHandler handles requests for the GET /teams subresource route on User
func GetTeamsHandler(store legacy.LegacyIdentityStore) func(ctx context.Context, writer app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
	return func(ctx context.Context, writer app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
		userUID := req.ResourceIdentifier.Name

		ns, err := request.NamespaceInfoFrom(ctx, true)
		if err != nil {
			return err
		}

		result, err := store.ListUserTeams(ctx, ns, legacy.ListUserTeamsQuery{
			UserUID:    userUID,
			Pagination: common.PaginationFromListQuery(req.URL.Query()),
		})
		if err != nil {
			return err
		}

		items := make([]v0alpha1.VersionsV0alpha1Kinds6RoutesTeamsGETResponseUserTeam, len(result.Items))
		for i, team := range result.Items {
			items[i] = v0alpha1.VersionsV0alpha1Kinds6RoutesTeamsGETResponseUserTeam{
				Title:      team.Name,
				TeamRef:    v0alpha1.TeamRef{Name: team.UID},
				Permission: v0alpha1.TeamPermission(team.Permission.String()),
			}
		}

		return json.NewEncoder(writer).Encode(v0alpha1.GetTeams{
			GetTeamsBody: v0alpha1.GetTeamsBody{
				Items: items,
			},
		})
	}
}
