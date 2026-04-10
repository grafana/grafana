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

const (
	playlistAPIGroup = "playlist.grafana.app"
	playlistResource = "playlists"
)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
	features      featuremgmt.FeatureToggles
	accessService accesscontrol.Service
	accessClient  authlib.AccessClient
	logger        log.Logger
}

func RegisterAppInstaller(
	features featuremgmt.FeatureToggles,
	accessControlService accesscontrol.Service,
	accessClient authlib.AccessClient,
) (*AppInstaller, error) {
	if err := DeclareFixedRoles(accessControlService); err != nil {
		return nil, fmt.Errorf("declaring fixed roles: %w", err)
	}
	// Register fixed roles immediately when AC has already been initialized.
	// This avoids startup-order races where playlist roles are declared after
	// initial role registration and would otherwise not be effective until next reload.
	if roleRegistry, ok := accessControlService.(accesscontrol.RoleRegistry); ok {
		if err := roleRegistry.RegisterFixedRoles(context.Background()); err != nil {
			return nil, fmt.Errorf("registering fixed roles: %w", err)
		}
	}

	installer := &AppInstaller{
		features:      features,
		accessService: accessControlService,
		accessClient:  accessClient,
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
				Group:       playlistAPIGroup,
				Resource:    playlistResource,
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
				// Toggle-on path only: temporary compatibility fallback for None-role users
				// with explicit playlist RBAC permissions, while AccessClient parity is finalized.
				legacyAllowed, legacyErr := p.checkNoneRoleFallback(ctx, user, attr)
				if legacyErr != nil {
					return authorizer.DecisionDeny, "permission evaluation failed", legacyErr
				}
				if legacyAllowed {
					return authorizer.DecisionAllow, "", nil
				}
				return authorizer.DecisionDeny, "insufficient permissions", nil
			}

			return authorizer.DecisionAllow, "", nil
		},
	)
}

func (p *AppInstaller) checkNoneRoleFallback(ctx context.Context, user identity.Requester, attr authorizer.Attributes) (bool, error) {
	var action string
	switch attr.GetVerb() {
	case "get", "list", "watch":
		action = ActionPlaylistsRead
	case "create", "update", "patch", "delete", "deletecollection":
		action = ActionPlaylistsWrite
	default:
		return false, nil
	}

	perms, err := p.accessService.GetUserPermissions(ctx, user, accesscontrol.Options{})
	if err != nil {
		return false, err
	}

	name := attr.GetName()
	for _, perm := range perms {
		if perm.Action != action {
			continue
		}
		if perm.Scope == "*" || perm.Scope == "playlists:*" || perm.Scope == "playlists:uid:*" {
			return true, nil
		}
		if name != "" && perm.Scope == "playlists:uid:"+name {
			return true, nil
		}
	}
	return false, nil
}
