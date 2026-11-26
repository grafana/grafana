package team

import (
	"context"
	"errors"

	claims "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/trace"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
)

var _ SearchBackend = (*legacyStoreSearchClient)(nil)

// legacyStoreSearchClient serves the title uniqueness lookup of team validation
// from the legacy SQL store. The standalone IAM API server has no team service
// for legacySearchClient, so it queries the store teams are written to.
type legacyStoreSearchClient struct {
	store  legacy.LegacyIdentityStore
	tracer trace.Tracer
}

func NewLegacyStoreSearchClient(store legacy.LegacyIdentityStore, tracer trace.Tracer) *legacyStoreSearchClient {
	return &legacyStoreSearchClient{store: store, tracer: tracer}
}

func (c *legacyStoreSearchClient) Search(ctx context.Context, req SearchQuery) (*iamv0.GetSearchTeamsResponse, error) {
	ctx, span := c.tracer.Start(ctx, "team.legacystoresearch")
	defer span.End()

	if req.Title == "" {
		return nil, errors.New("team search without a title is not supported by the legacy store backend")
	}

	ns, err := claims.ParseNamespace(req.Namespace)
	if err != nil {
		return nil, err
	}

	res, err := c.store.ListTeams(ctx, ns, legacy.ListTeamQuery{Name: req.Title})
	if err != nil {
		span.RecordError(err)
		return nil, err
	}

	resp := &iamv0.GetSearchTeamsResponse{GetSearchTeamsBody: iamv0.GetSearchTeamsBody{
		TotalHits: int64(len(res.Teams)),
		Hits:      make([]iamv0.GetSearchTeamsTeamHit, 0, len(res.Teams)),
	}}
	for _, t := range res.Teams {
		resp.Hits = append(resp.Hits, iamv0.GetSearchTeamsTeamHit{
			Name:  t.UID,
			Title: t.Name,
		})
	}
	return resp, nil
}
