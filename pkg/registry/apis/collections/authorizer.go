package collections

import (
	"context"
	"errors"
	"sync/atomic"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
	"github.com/grafana/grafana/pkg/registry/apps/playlist"
)

// newAuthorizer sends slideshow requests through the playlist authorizer, because slideshows are
// shared within an org like playlists and use the playlist permissions. Everything else keeps the
// per-user ownership rules that stars rely on.
func newAuthorizer(accessClient authlib.AccessChecker, logger log.Logger) authorizer.Authorizer {
	slideshows := playlist.NewAuthorizer(accessClient, logger)
	owned := &utils.AuthorizeFromName{
		AllowOrgAdmin: true,
		Resource: map[string][]utils.ResourceOwner{
			"stars": {utils.UserResourceOwner},
		},
	}

	return authorizer.AuthorizerFunc(func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
		if attr.IsResourceRequest() && attr.GetResource() == "slideshows" {
			return slideshows.Authorize(ctx, attr)
		}
		return owned.Authorize(ctx, attr)
	})
}

// lateAccessChecker is an access checker that is given its client after the builder has been
// constructed, because the builder's constructor does not take one.
type lateAccessChecker struct {
	client atomic.Pointer[authlib.AccessClient]
}

func (l *lateAccessChecker) set(client authlib.AccessClient) {
	l.client.Store(&client)
}

func (l *lateAccessChecker) Check(ctx context.Context, info authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	client := l.client.Load()
	if client == nil {
		return authlib.CheckResponse{}, errors.New("access client is not available")
	}
	return (*client).Check(ctx, info, req, folder)
}
