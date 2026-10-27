package rbac_test

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationLegacyCheckReusesLibraryPanelResolver(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	database := sqlstore.NewTestStore(t)
	err := database.WithDbSession(t.Context(), func(session *db.Session) error {
		_, err := session.Insert(&model.LibraryElement{
			OrgID:     12,
			UID:       "panel",
			Name:      "Panel",
			FolderID:  42, //nolint:staticcheck // Exercise the existing resolver's legacy lookup.
			FolderUID: "parent",
			Kind:      int64(model.PanelElement),
			Model:     json.RawMessage(`{}`),
			Created:   time.Now(),
			Updated:   time.Now(),
		})
		return err
	})
	require.NoError(t, err)

	for _, tc := range []struct {
		name          string
		folderVisible bool
		want          *authzextv1.LegacyCheckResponse
	}{
		{
			name:          "folder visible to checked user",
			folderVisible: true,
			want:          &authzextv1.LegacyCheckResponse{Allowed: true},
		},
		{
			name:          "folder hidden from checked user",
			folderVisible: false,
			want: &authzextv1.LegacyCheckResponse{
				Allowed: false,
				Error:   "could not evaluate legacy expression: could not resolve library.panels:uid:panel: " + folder.ErrAccessDenied.Error(),
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ac := acimpl.ProvideAccessControlTest()
			permissions := []accesscontrol.Permission{
				{
					Action: libraryelements.ActionLibraryPanelsRead,
					Scope:  "folders:uid:parent",
				},
			}
			if tc.folderVisible {
				permissions = append(permissions, accesscontrol.Permission{
					Action: folder.ActionFoldersRead,
					Scope:  "folders:uid:parent",
				})
			}
			s := rbac.NewTestService("checked-user", permissions, nil).
				WithLegacyScopeResolvers(acimpl.ProvideScopeResolverRegistry(ac), types.OrgNamespaceFormatter)
			folders := &legacyCheckFolders{ac: ac}
			// Normal service initialization registers the existing callback after
			// AuthZ has already obtained the shared registry.
			libraryelements.ProvideService(
				setting.NewCfg(),
				database,
				nil,
				folders,
				featuremgmt.WithFeatures(),
				ac,
				&legacyCheckDashboards{},
				nil,
				nil,
			)
			ctx := identity.WithRequester(t.Context(), &identity.StaticRequester{
				Type:           types.TypeAccessPolicy,
				UserUID:        "rpc-caller",
				Namespace:      "org-12",
				IsGrafanaAdmin: true,
			})
			got, err := s.LegacyCheck(ctx, &authzextv1.LegacyCheckRequest{
				Namespace: "org-12",
				Subject:   "user:checked-user",
				Expression: &authzextv1.LegacyExpression{
					Node: &authzextv1.LegacyExpression_Permission{
						Permission: &authzextv1.LegacyPermission{
							Action: libraryelements.ActionLibraryPanelsRead,
							Scopes: []string{"library.panels:uid:panel"},
						},
					},
				},
			})
			require.NoError(t, err)
			require.True(t, proto.Equal(tc.want, got), "want %v, got %v", tc.want, got)
			grants := map[string][]string{
				libraryelements.ActionLibraryPanelsRead: {"folders:uid:parent"},
			}
			if tc.folderVisible {
				grants[folder.ActionFoldersRead] = []string{"folders:uid:parent"}
			}
			require.Equal(t, &identity.StaticRequester{
				Type:           types.TypeUser,
				UserID:         1,
				UserUID:        "checked-user",
				OrgID:          12,
				Namespace:      "org-12",
				IsGrafanaAdmin: false,
				CacheKey:       "org-12:user:checked-user",
				Permissions:    map[int64]map[string][]string{12: grants},
			}, folders.requester)
		})
	}
}

type legacyCheckFolders struct {
	folder.Service
	ac        accesscontrol.AccessControl
	requester identity.Requester
}

func (s *legacyCheckFolders) Get(
	ctx context.Context,
	query *folder.GetFolderQuery,
) (*folder.Folder, error) {
	s.requester = query.SignedInUser
	allowed, err := s.ac.Evaluate(ctx, query.SignedInUser,
		accesscontrol.EvalPermission(folder.ActionFoldersRead, "folders:uid:parent"))
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, folder.ErrAccessDenied
	}
	return &folder.Folder{
		ID:    42, //nolint:staticcheck // Exercise legacy folder ID resolution.
		UID:   "parent",
		OrgID: query.OrgID,
		Title: "Parent",
	}, nil
}

func (s *legacyCheckFolders) GetParents(
	context.Context,
	folder.GetParentsQuery,
) ([]*folder.Folder, error) {
	return nil, nil
}

type legacyCheckDashboards struct {
	dashboards.DashboardService
}

func (s *legacyCheckDashboards) GetDashboardsByLibraryPanelUID(
	context.Context,
	string,
	int64,
) ([]*dashboards.DashboardRef, error) {
	return nil, nil
}
