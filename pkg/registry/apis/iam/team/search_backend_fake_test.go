package team

import (
	"context"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

func selectorForBackend(backend SearchBackend) *dualwrite.Selector[SearchBackend] {
	return dualwrite.NewSelector(dualwrite.ProvideServiceForTests(&setting.Cfg{}), iamv0.TeamResourceInfo.GroupResource(), backend, backend)
}

type fakeSearchBackend struct {
	searchFunc    func(context.Context, SearchQuery) (*iamv0.GetSearchTeamsResponse, error)
	hits          []iamv0.GetSearchTeamsTeamHit
	err           error
	lastQuery     *SearchQuery
	lastRequester identity.Requester
}

func (c *fakeSearchBackend) Search(ctx context.Context, query SearchQuery) (*iamv0.GetSearchTeamsResponse, error) {
	c.lastQuery = &query
	c.lastRequester, _ = identity.GetRequester(ctx)
	if c.searchFunc != nil {
		return c.searchFunc(ctx, query)
	}
	return &iamv0.GetSearchTeamsResponse{GetSearchTeamsBody: iamv0.GetSearchTeamsBody{
		Hits:      c.hits,
		TotalHits: int64(len(c.hits)),
	}}, c.err
}
