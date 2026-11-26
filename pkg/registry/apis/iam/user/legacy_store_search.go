package user

import (
	"context"
	"errors"

	claims "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/trace"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
)

var _ SearchBackend = (*legacyStoreSearchClient)(nil)

// legacyStoreSearchClient serves the email and login uniqueness lookups of user
// validation from the legacy SQL store. The standalone IAM API server has no
// org service for legacySearchClient, so it queries the store users are written to.
type legacyStoreSearchClient struct {
	store  legacy.LegacyIdentityStore
	tracer trace.Tracer
}

func NewLegacyStoreSearchClient(store legacy.LegacyIdentityStore, tracer trace.Tracer) *legacyStoreSearchClient {
	return &legacyStoreSearchClient{store: store, tracer: tracer}
}

func (c *legacyStoreSearchClient) Search(ctx context.Context, req SearchQuery) (*iamv0.GetSearchUsersResponse, error) {
	ctx, span := c.tracer.Start(ctx, "user.legacystoresearch")
	defer span.End()

	if req.Email == nil && req.Login == nil {
		return nil, errors.New("user search by query is not supported by the legacy store backend")
	}

	ns, err := claims.ParseNamespace(req.Namespace)
	if err != nil {
		return nil, err
	}

	query := legacy.ListUserQuery{}
	if req.Email != nil {
		query.Email = *req.Email
	}
	if req.Login != nil {
		query.Login = *req.Login
	}
	// ListUsers treats an empty value as no filter, which would match every user.
	// The store's unique email and login indexes still reject such a duplicate with a 409.
	if query.Email == "" && query.Login == "" {
		return iamv0.NewGetSearchUsersResponse(), nil
	}

	res, err := c.store.ListUsers(ctx, ns, query)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}

	resp := iamv0.NewGetSearchUsersResponse()
	resp.TotalHits = int64(len(res.Items))
	resp.Hits = make([]iamv0.GetSearchUsersUserHit, 0, len(res.Items))
	for _, u := range res.Items {
		resp.Hits = append(resp.Hits, iamv0.GetSearchUsersUserHit{
			Name:       u.UID,
			Title:      u.Name,
			Email:      u.Email,
			Login:      u.Login,
			InternalId: u.ID,
		})
	}
	return resp, nil
}
