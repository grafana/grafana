package collections

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
	"github.com/grafana/grafana/pkg/registry/apps/playlist"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

// newAuthorizer sends slideshow requests to the playlist permissions, because slideshows are
// shared within an org like playlists. Everything else keeps the per-user ownership rules that
// stars rely on.
func newAuthorizer(ac accesscontrol.AccessControl, logger log.Logger) authorizer.Authorizer {
	slideshows := playlist.NewAuthorizer(ac, logger)
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
