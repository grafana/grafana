package user

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"slices"
	"sort"

	claims "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
)

var _ UserTeamsBackend = (*legacyUserTeamsBackend)(nil)

type legacyUserTeamsBackend struct {
	store  legacy.LegacyIdentityStore
	log    log.Logger
	tracer trace.Tracer
}

func NewLegacyUserTeamsBackend(store legacy.LegacyIdentityStore, tracer trace.Tracer) *legacyUserTeamsBackend {
	return &legacyUserTeamsBackend{
		store:  store,
		log:    log.New("grafana-apiserver.teams.legacy-members-search"),
		tracer: tracer,
	}
}

func (c *legacyUserTeamsBackend) ListUserTeams(ctx context.Context, query UserTeamsQuery) (*UserTeamsPage, error) {
	ctx, span := c.tracer.Start(ctx, "team.legacy-members-search")
	defer span.End()
	logger := c.log.FromContext(ctx)

	if query.Limit > common.MaxListLimit {
		return nil, fmt.Errorf("limit cannot be greater than %d", common.MaxListLimit)
	}
	if query.Limit < 1 {
		query.Limit = common.DefaultListLimit
	}
	if query.UserUID == "" {
		return &UserTeamsPage{}, nil
	}
	if query.Namespace == "" {
		return nil, errors.New("missing namespace in user teams query")
	}
	ns, err := claims.ParseNamespace(query.Namespace)
	if err != nil {
		return nil, err
	}

	// SQL pages by numeric ID, but public cursors use team UIDs in both backends.
	// All memberships must be read before sorting each page.
	const pageSize = 500
	var items []legacy.UserTeam
	var continueToken int64
	for {
		p, err := c.store.ListUserTeams(ctx, ns, legacy.ListUserTeamsQuery{
			UserUID:    query.UserUID,
			Pagination: common.Pagination{Limit: pageSize, Continue: continueToken},
		})
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, "list user teams failed")
			logger.Error("failed to list user teams", "user", query.UserUID, "error", err)
			return nil, fmt.Errorf("list user teams: %w", err)
		}
		items = append(items, p.Items...)
		if p.Continue == 0 {
			break
		}
		continueToken = p.Continue
	}
	slices.SortFunc(items, func(a, b legacy.UserTeam) int { return cmp.Compare(a.UID, b.UID) })
	if len(query.After) > 0 {
		idx := sort.Search(len(items), func(i int) bool { return items[i].UID > query.After[0] })
		items = items[idx:]
	}
	if len(items) > int(query.Limit) {
		items = items[:int(query.Limit)]
	}

	logger.Debug("legacy user-teams search resolved",
		"user", query.UserUID,
		"namespace", ns.Value,
		"limit", query.Limit,
		"search_after", query.After,
		"returned", len(items),
	)

	page := &UserTeamsPage{}
	if len(items) == 0 {
		return page, nil
	}
	page.Items = make([]iamv0.GetUserTeamsUserTeam, 0, len(items))
	for _, item := range items {
		if item.UID == "" {
			continue
		}
		page.Items = append(page.Items, iamv0.GetUserTeamsUserTeam{
			User:       query.UserUID,
			Team:       item.UID,
			Permission: string(common.MapTeamPermission(item.Permission)),
			External:   item.External,
		})
	}
	if int64(len(items)) >= query.Limit {
		page.Next = []string{items[len(items)-1].UID}
	}
	return page, nil
}
