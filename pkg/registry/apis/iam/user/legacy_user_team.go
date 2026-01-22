package user

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"strings"

	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

var _ resourcepb.ResourceIndexClient = (*LegacyUserTeamSearchClient)(nil)

type LegacyUserTeamSearchClient struct {
	store  legacy.LegacyIdentityStore
	log    *slog.Logger
	tracer trace.Tracer
}

func NewLegacyUserTeamSearchClient(store legacy.LegacyIdentityStore, tracer trace.Tracer) *LegacyUserTeamSearchClient {
	return &LegacyUserTeamSearchClient{
		store:  store,
		tracer: tracer,
		log:    slog.Default().With("logger", "legacy-user-team-search-client"),
	}
}

func (c *LegacyUserTeamSearchClient) Search(ctx context.Context, req *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	ctx, span := c.tracer.Start(ctx, "user.teams.legacy")
	defer span.End()

	if req == nil || req.Options == nil || req.Options.Key == nil {
		return nil, fmt.Errorf("missing search request key")
	}

	signedInUser, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	ns := claims.NamespaceInfo{
		Value: signedInUser.GetNamespace(),
		OrgID: signedInUser.GetOrgID(),
	}

	if req.Limit > 100 {
		req.Limit = 100
	}
	if req.Limit <= 0 {
		req.Limit = 50
	}

	if req.Page > math.MaxInt32 || req.Page < 1 {
		return nil, fmt.Errorf("invalid page number: %d", req.Page)
	}

	subjectUID := subjectUIDFromRequirements(req.Options.Fields)
	if subjectUID == "" {
		return nil, fmt.Errorf("missing required field filter %q", resource.SEARCH_FIELD_PREFIX+builders.TEAM_BINDING_SUBJECT_NAME)
	}

	fields := req.Fields
	if len(fields) == 0 {
		fields = []string{
			resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_TEAM_REF,
			resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_PERMISSION,
			resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_EXTERNAL,
		}
	}

	cols := userTeamColumns(fields)
	resp := &resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{Columns: cols},
	}

	var (
		continueToken int64
		pageItems     []legacy.UserTeam
	)

	for p := int64(1); p <= req.Page; p++ {
		res, err := c.store.ListUserTeams(ctx, ns, legacy.ListUserTeamsQuery{
			UserUID: subjectUID,
			Pagination: common.Pagination{
				Limit:    req.Limit,
				Continue: continueToken,
			},
		})
		if err != nil {
			return nil, err
		}

		pageItems = res.Items
		continueToken = res.Continue

		if p < req.Page && continueToken == 0 {
			pageItems = nil
			break
		}
	}

	for _, t := range pageItems {
		resp.Results.Rows = append(resp.Results.Rows, &resourcepb.ResourceTableRow{
			Key: &resourcepb.ResourceKey{
				Namespace: req.Options.Key.Namespace,
				Group:     req.Options.Key.Group,
				Resource:  req.Options.Key.Resource,
				// We don't have the team_member UID here, using team UID instead for this subresource response.
				Name: t.UID,
			},
			Cells: userTeamCells(t, fields, subjectUID),
		})
	}

	resp.TotalHits = int64(len(resp.Results.Rows))
	return resp, nil
}

func (c *LegacyUserTeamSearchClient) GetStats(ctx context.Context, in *resourcepb.ResourceStatsRequest, _ ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
	return &resourcepb.ResourceStatsResponse{}, nil
}

func (c *LegacyUserTeamSearchClient) RebuildIndexes(ctx context.Context, in *resourcepb.RebuildIndexesRequest, _ ...grpc.CallOption) (*resourcepb.RebuildIndexesResponse, error) {
	return &resourcepb.RebuildIndexesResponse{}, nil
}

func subjectUIDFromRequirements(reqs []*resourcepb.Requirement) string {
	want1 := resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_SUBJECT_NAME // fields.subject.name
	want2 := builders.TEAM_BINDING_SUBJECT_NAME                                // subject.name

	for _, r := range reqs {
		if r == nil {
			continue
		}
		if r.Key != want1 && r.Key != want2 {
			continue
		}
		if len(r.Values) < 1 {
			return ""
		}
		return r.Values[0]
	}

	return ""
}

func userTeamColumns(fields []string) []*resourcepb.ResourceTableColumnDefinition {
	cols := make([]*resourcepb.ResourceTableColumnDefinition, 0, len(fields))
	for _, f := range fields {
		name := strings.TrimPrefix(f, resource.SEARCH_FIELD_PREFIX)
		if col, ok := builders.TeamBindingTableColumnDefinitions[name]; ok {
			cols = append(cols, col)
		}
	}
	return cols
}

func userTeamCells(t legacy.UserTeam, fields []string, subjectUID string) [][]byte {
	cells := make([][]byte, 0, len(fields))
	for _, f := range fields {
		name := strings.TrimPrefix(f, resource.SEARCH_FIELD_PREFIX)
		switch name {
		case builders.TEAM_BINDING_SUBJECT_NAME:
			cells = append(cells, []byte(subjectUID))
		case builders.TEAM_BINDING_TEAM_REF:
			cells = append(cells, []byte(t.UID))
		case builders.TEAM_BINDING_PERMISSION:
			cells = append(cells, []byte(string(common.MapTeamPermission(t.Permission))))
		case builders.TEAM_BINDING_EXTERNAL:
			cells = append(cells, []byte("false"))
		}
	}
	return cells
}
