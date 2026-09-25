package user

import (
	"context"
	"fmt"
	"slices"

	"golang.org/x/sync/errgroup"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

const userTeamsGetParallelism = 8

var _ UserTeamsBackend = (*unifiedUserTeamsBackend)(nil)

type unifiedUserTeamsBackend struct {
	client     resourcepb.ResourceIndexClient
	teamGetter rest.Getter
}

func NewUnifiedUserTeamsBackend(client resourcepb.ResourceIndexClient, teamGetter rest.Getter) *unifiedUserTeamsBackend {
	return &unifiedUserTeamsBackend{client: client, teamGetter: teamGetter}
}

func (c *unifiedUserTeamsBackend) ListUserTeams(ctx context.Context, query UserTeamsQuery) (*UserTeamsPage, error) {
	gr := iamv0alpha1.TeamResourceInfo.GroupResource()
	result, err := c.client.Search(ctx, &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key:    &resourcepb.ResourceKey{Group: gr.Group, Resource: gr.Resource, Namespace: query.Namespace},
			Fields: []*resourcepb.Requirement{{Key: builders.TEAM_SEARCH_MEMBERS, Operator: string(selection.Equals), Values: []string{query.UserUID}}},
		},
		Fields:       []string{resource.SEARCH_FIELD_NAME},
		Limit:        query.Limit,
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
		SortBy:       []*resourcepb.ResourceSearchRequest_Sort{{Field: resource.SEARCH_FIELD_NAME}},
		SearchAfter:  query.After,
		Explain:      query.Explain,
	})
	if err := resource.StatusErrorFromResponse(result.GetError(), err); err != nil {
		return nil, err
	}
	rows, err := decodeUserTeamSearchRows(result)
	if err != nil {
		return nil, apierrors.NewInternalError(err)
	}
	page := &UserTeamsPage{}
	if len(rows) == 0 {
		return page, nil
	}
	page.Items, err = c.buildItems(common.WithSubresourceNamespace(ctx), rows, query.UserUID)
	if err != nil {
		return nil, err
	}
	// Missing teams or removed memberships must not stop a pagination walk early.
	if int64(len(rows)) >= query.Limit {
		page.Next = rows[len(rows)-1].sortFields
		page.ResourceVersion = result.GetResourceVersion()
	}
	return page, nil
}

type userTeamSearchRow struct {
	key        *resourcepb.ResourceKey
	sortFields []string
}

func decodeUserTeamSearchRows(result *resourcepb.ResourceSearchResponse) ([]userTeamSearchRow, error) {
	if result == nil {
		return nil, nil
	}

	switch result.GetResultFormat() {
	case resourcepb.ResourceSearchRequest_UNSPECIFIED, resourcepb.ResourceSearchRequest_RESOURCE_TABLE:
		table := result.GetResults()
		if table == nil {
			return nil, nil
		}
		rows := make([]userTeamSearchRow, 0, len(table.Rows))
		for _, row := range table.Rows {
			if row == nil {
				continue
			}
			rows = append(rows, userTeamSearchRow{
				key:        row.Key,
				sortFields: row.SortFields,
			})
		}
		return rows, nil
	case resourcepb.ResourceSearchRequest_FIELD_VALUES:
		rows := make([]userTeamSearchRow, 0, len(result.Rows))
		for i, row := range result.Rows {
			if row == nil || row.Key == nil {
				return nil, fmt.Errorf("field-value user team search result row %d has no resource key", i)
			}
			rows = append(rows, userTeamSearchRow{key: row.Key, sortFields: row.SortFields})
		}
		return rows, nil
	default:
		return nil, fmt.Errorf("unsupported search result format %d", result.GetResultFormat())
	}
}

func (c *unifiedUserTeamsBackend) buildItems(ctx context.Context, rows []userTeamSearchRow, userName string) ([]iamv0alpha1.GetUserTeamsUserTeam, error) {
	items := make([]iamv0alpha1.GetUserTeamsUserTeam, len(rows))
	// The index has no per-user permission/external values. Bound the team reads
	// so users with many memberships cannot overwhelm the apiserver.
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(userTeamsGetParallelism)
	for i, row := range rows {
		if row.key == nil {
			continue
		}
		g.Go(func() error {
			teamObj, err := c.teamGetter.Get(gctx, row.key.Name, &metav1.GetOptions{})
			if apierrors.IsNotFound(err) {
				return nil
			}
			if err != nil {
				return err
			}
			t, ok := teamObj.(*iamv0alpha1.Team)
			if !ok {
				return nil
			}
			m, ok := findMember(t, userName)
			if !ok {
				return nil
			}
			items[i] = iamv0alpha1.GetUserTeamsUserTeam{
				User:       userName,
				Team:       row.key.Name,
				Permission: string(m.Permission),
				External:   m.External,
			}
			return nil
		})
	}
	if err := g.Wait(); err != nil {
		return nil, err
	}
	return slices.DeleteFunc(items, func(item iamv0alpha1.GetUserTeamsUserTeam) bool { return item.Team == "" }), nil
}

func findMember(t *iamv0alpha1.Team, userName string) (iamv0alpha1.TeamTeamMember, bool) {
	for _, m := range t.Spec.Members {
		if m.Name == userName {
			return m, true
		}
	}
	return iamv0alpha1.TeamTeamMember{}, false
}
