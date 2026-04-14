package playlist

import (
	"context"
	"fmt"

	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/playlist/pkg/apis/manifestdata"
	playlistapp "github.com/grafana/grafana/apps/playlist/pkg/app"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
)

var (
	_ appsdkapiserver.AppInstaller = (*AppInstaller)(nil)
)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
	features      featuremgmt.FeatureToggles
	accessControl accesscontrol.AccessControl
	logger        log.Logger
}

func RegisterAppInstaller(
	features featuremgmt.FeatureToggles,
	accessControlService accesscontrol.Service,
	ac accesscontrol.AccessControl,
) (*AppInstaller, error) {
	if err := DeclareFixedRoles(accessControlService); err != nil {
		return nil, fmt.Errorf("declaring fixed roles: %w", err)
	}

	installer := &AppInstaller{
		features:      features,
		accessControl: ac,
		logger:        log.New("playlist.api"),
	}
	specificConfig := any(&playlistapp.PlaylistConfig{
		//nolint:staticcheck // not yet migrated to OpenFeature
		EnableReconcilers: features.IsEnabledGlobally(featuremgmt.FlagPlaylistsReconciler),
	})
	provider := simple.NewAppProvider(manifestdata.LocalManifest(), specificConfig, playlistapp.New)

	appConfig := app.Config{
		KubeConfig:     restclient.Config{}, // this will be overridden by the installer's InitializeApp method
		ManifestData:   *manifestdata.LocalManifest().ManifestData,
		SpecificConfig: specificConfig,
	}
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, &manifestdata.GoTypeAssociator{})
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i

	return installer, nil
}

func (p *AppInstaller) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			if !attr.IsResourceRequest() {
				return authorizer.DecisionNoOpinion, "", nil
			}

			user, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "valid user is required", err
			}

			//nolint:staticcheck // not yet migrated to OpenFeature
			if !p.features.IsEnabledGlobally(featuremgmt.FlagPlaylistsRBAC) {
				// Hotfix: grant None-role users viewer-level access until the toggle is enabled.
				// All other roles are handled by the default role authorizer.
				if user.GetOrgRole() != org.RoleNone {
					return authorizer.DecisionNoOpinion, "", nil
				}
				switch attr.GetVerb() {
				case "get", "list", "watch":
					return authorizer.DecisionAllow, "", nil
				default:
					return authorizer.DecisionNoOpinion, "", nil
				}
			}

			var action string
			switch attr.GetVerb() {
			case "get", "list", "watch":
				action = ActionPlaylistsRead
			case "create", "update", "patch", "delete", "deletecollection":
				action = ActionPlaylistsWrite
			default:
				return authorizer.DecisionDeny, "unsupported verb: " + attr.GetVerb(), nil
			}

			hasAccess, err := p.accessControl.Evaluate(ctx, user, accesscontrol.EvalPermission(action))
			if err != nil {
				p.logger.Error("failed to evaluate permission", "error", err)
				return authorizer.DecisionDeny, "permission evaluation failed", err
			}
			if !hasAccess {
				return authorizer.DecisionDeny, "insufficient permissions", nil
			}

			return authorizer.DecisionAllow, "", nil
		},
	)
}
