package acimpl

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/accesscontrol/permreg"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// The permissions returned here are cached per org, so they must not share a
// backing array with the basic role definition, which is global to the process.
// Otherwise resolving another org overwrites the permissions already handed out.
func TestService_getBasicRolePermissions_doesNotShareBackingArrayAcrossOrgs(t *testing.T) {
	s := setupBasicRoleService(t)

	org2, err := s.getBasicRolePermissions(context.Background(), "Editor", 2)
	require.NoError(t, err)
	require.Equal(t, []string{"folders:uid:org2-folder"}, folderScopes(org2))

	org3, err := s.getBasicRolePermissions(context.Background(), "Editor", 3)
	require.NoError(t, err)
	require.Equal(t, []string{"folders:uid:org3-folder"}, folderScopes(org3))

	require.Equal(t, []string{"folders:uid:org2-folder"}, folderScopes(org2),
		"resolving org 3 must not mutate the permissions already returned for org 2")
}

// Run with -race: concurrent orgs used to write into the same backing array
// after releasing rolesMu.
func TestService_getBasicRolePermissions_concurrentOrgsAreIsolated(t *testing.T) {
	s := setupBasicRoleService(t)

	const orgs = 16
	var wg sync.WaitGroup
	errs := make([]error, orgs)
	got := make([][]string, orgs)

	for i := range orgs {
		wg.Add(1)
		go func() {
			defer wg.Done()
			orgID := int64(i + 1)
			perms, err := s.getBasicRolePermissions(context.Background(), "Editor", orgID)
			errs[i], got[i] = err, folderScopes(perms)
		}()
	}
	wg.Wait()

	for i := range orgs {
		require.NoError(t, errs[i])
		require.Equal(t, []string{fmt.Sprintf("folders:uid:org%d-folder", i+1)}, got[i])
	}
}

// setupBasicRoleService returns a service whose store hands each org its own
// managed folder permission, so cross-org bleed is directly observable.
func setupBasicRoleService(t *testing.T) *Service {
	t.Helper()

	store := &actest.MockStore{}
	store.On("GetBasicRolesPermissions", mock.Anything, mock.Anything).Return(
		func(_ context.Context, q accesscontrol.GetUserPermissionsQuery) []accesscontrol.Permission {
			return []accesscontrol.Permission{{
				Action: "folders:read",
				Scope:  fmt.Sprintf("folders:uid:org%d-folder", q.OrgID),
			}}
		},
		func(_ context.Context, _ accesscontrol.GetUserPermissionsQuery) error { return nil },
	)

	s := &Service{
		cfg:            setting.NewCfg(),
		features:       featuremgmt.WithFeatures(),
		log:            log.New("accesscontrol-test"),
		registrations:  accesscontrol.RegistrationList{},
		roles:          accesscontrol.BuildBasicRoleDefinitions(),
		store:          store,
		cache:          localcache.ProvideService(),
		permRegistry:   permreg.ProvidePermissionRegistry(),
		actionResolver: resourcepermissions.NewActionSetService(),
	}

	// Fixed-role registration builds the process-wide basic role by repeated
	// append, which leaves the slice with spare capacity.
	editor := s.roles["Editor"]
	for i := 0; i < 3; i++ {
		editor.Permissions = append(editor.Permissions, accesscontrol.Permission{
			Action: fmt.Sprintf("fixed:action:%d", i),
		})
	}
	require.Greater(t, cap(editor.Permissions), len(editor.Permissions),
		"test requires spare capacity on the shared basic role slice")

	return s
}

func folderScopes(perms []accesscontrol.Permission) []string {
	out := make([]string, 0, len(perms))
	for _, p := range perms {
		if p.Scope != "" {
			out = append(out, p.Scope)
		}
	}
	return out
}
