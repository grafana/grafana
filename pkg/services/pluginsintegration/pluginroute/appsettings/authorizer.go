package appsettings

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
)

// GetAuthorizer requires app access for every request, as the legacy app
// endpoints do, except writes to the settings themselves, which require the
// permission of the legacy endpoint that updates plugin settings.
func (b *Builder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
			user, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "valid user is required", err
			}
			if attr.GetResource() == apppluginV0.APP_RESOURCE_NAME && attr.GetSubresource() == "" && !attr.IsReadOnly() {
				if b.writeChecker == nil {
					return authorizer.DecisionDeny, "no settings write checker is configured", nil
				}
				return b.writeChecker(ctx, user, b.pluginJSON.ID)
			}
			return b.accessChecker(ctx, user, b.pluginJSON.ID)
		},
	)
}
