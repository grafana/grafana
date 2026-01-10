package app

import (
	"context"
	"encoding/json"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

// GetTeamsHandler handles requests for the GET /teams subresource route on User
func GetTeamsHandler(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
	// Dummy implementation - returns empty list
	response := v0alpha1.GetTeams{
		TypeMeta: metav1.TypeMeta{
			APIVersion: fmt.Sprintf("%s/%s", v0alpha1.APIGroup, v0alpha1.APIVersion),
			Kind:       "GetTeams",
		},
		GetTeamsBody: v0alpha1.GetTeamsBody{
			Items: []v0alpha1.VersionsV0alpha1Kinds6RoutesTeamsGETResponseUserTeam{},
		},
	}
	return json.NewEncoder(writer).Encode(response)
}
