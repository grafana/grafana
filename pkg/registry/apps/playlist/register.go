package playlist

import (
	"context"
	"fmt"

	authlib "github.com/grafana/authlib/types"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/playlist/pkg/apis/manifestdata"
	playlistv1 "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v1"
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
	features     featuremgmt.FeatureToggles
	accessClient authlib.AccessClient
	logger       log.Logger
}

// ProvidePlaylistRoles declares the fixed RBAC roles for playlists and registers
// them immediately. This must be wired in single-tenant mode; MT flavors that
// manage roles differently can omit it.
func ProvidePlaylistRoles(service accesscontrol.Service) error {
	if err := DeclareFixedRoles(service); err != nil {
		return fmt.Errorf("declaring fixed roles: %w", err)
	}
	// Register immediately in case the role registry has already been seeded,
	// so playlist roles are effective without requiring a server restart.
	if roleRegistry, ok := service.(accesscontrol.RoleRegistry); ok {
		if err := roleRegistry.RegisterFixedRoles(context.Background()); err != nil {
			return fmt.Errorf("registering fixed roles: %w", err)
		}
	}
	return nil
}

func RegisterAppInstaller(
	features featuremgmt.FeatureToggles,
	accessClient authlib.AccessClient,
) (*AppInstaller, error) {
	installer := &AppInstaller{
		features:     features,
		accessClient: accessClient,
		logger:       log.New("playlist.api"),
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
				// Toggle-off path: this app authorizer defers entirely to the legacy role authorizer.
				// The temporary "None-as-viewer" hotfix is enforced there (role.go), not in this file.
				return authorizer.DecisionNoOpinion, "", nil
			}

			authInfo, ok := authlib.AuthInfoFrom(ctx)
			if !ok {
				return authorizer.DecisionDeny, "valid user is required", fmt.Errorf("no identity found for request")
			}
			checkRsp, err := p.accessClient.Check(ctx, authInfo, authlib.CheckRequest{
				Verb:        attr.GetVerb(),
				Group:       playlistv1.APIGroup,
				Resource:    playlistv1.PlaylistSchema().Plural(),
				Namespace:   attr.GetNamespace(),
				Name:        attr.GetName(),
				Subresource: attr.GetSubresource(),
				Path:        attr.GetPath(),
			}, "")
			if err != nil {
				p.logger.Error("failed to evaluate permission", "error", err)
				return authorizer.DecisionDeny, "permission evaluation failed", err
			}
			if !checkRsp.Allowed {
				// For built-in org roles, defer to the default role authorizer when
				// AccessClient denies. This keeps legacy role behavior intact while
				// preserving existing authorization behavior for non-None roles.
				if user.GetOrgRole() != org.RoleNone {
					return authorizer.DecisionNoOpinion, "", nil
				}
				return authorizer.DecisionDeny, "insufficient permissions", nil
			}

			return authorizer.DecisionAllow, "", nil
		},
	)
}
