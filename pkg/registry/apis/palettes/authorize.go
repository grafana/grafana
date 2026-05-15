package palettes

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	paletteutils "github.com/grafana/grafana/pkg/registry/apis/palettes/utils"
	prefutils "github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
)

// Resource is the Kubernetes plural resource name for Palette objects.
const Resource = "palettes"

// paletteAuthorizer applies palette-specific rules on top of prefutils.AuthorizeFromName.
type paletteAuthorizer struct {
	inner *prefutils.AuthorizeFromName
}

// NewPaletteAuthorizer wraps inner with palette read and org-admin override behavior.
func NewPaletteAuthorizer(inner *prefutils.AuthorizeFromName) authorizer.Authorizer {
	return &paletteAuthorizer{inner: inner}
}

func (p *paletteAuthorizer) Authorize(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
	if attr.IsResourceRequest() && attr.GetResource() == Resource && attr.GetVerb() == "get" {
		return authorizer.DecisionAllow, "", nil
	}

	if attr.IsResourceRequest() && attr.GetResource() == Resource && attr.GetVerb() != "list" && attr.GetName() != "" {
		if owner, _, ok := paletteutils.ParseOwnerWithSuffix(attr.GetName()); ok && owner.Owner == prefutils.UserResourceOwner {
			user, _ := identity.GetRequester(ctx)
			if user != nil && user.GetOrgRole() == identity.RoleAdmin && owner.Identifier != user.GetIdentifier() {
				return authorizer.DecisionAllow, "", nil
			}
		}
	}

	return p.inner.Authorize(ctx, attr)
}
