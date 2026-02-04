package search

import (
	"context"

	"k8s.io/apimachinery/pkg/selection"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

func NewTeamMemberCountLookupFromIndex(client resourcepb.ResourceIndexClient) builders.TeamMemberCountLookup {
	if client == nil {
		return nil
	}

	return func(ctx context.Context, namespace, teamUID string) (int64, error) {
		resp, err := client.Search(ctx, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: namespace,
					Group:     iamv0.TeamBindingResourceInfo.GroupResource().Group,
					Resource:  iamv0.TeamBindingResourceInfo.GroupResource().Resource,
				},
				Fields: []*resourcepb.Requirement{
					{
						Key:      resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_TEAM,
						Operator: string(selection.Equals),
						Values:   []string{teamUID},
					},
				},
			},
			Limit: 0,
		})
		if err != nil {
			return 0, err
		}
		if resp == nil {
			return 0, nil
		}
		return resp.TotalHits, nil
	}
}
