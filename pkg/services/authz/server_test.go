package authz

import (
	"context"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/claims"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/services/authz/mappers"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
)

var folderTree = []*folder.Folder{
	{
		ID:    1,
		UID:   "top",
		Title: "top",
	},
	{
		ID:        2,
		UID:       "sub",
		Title:     "sub",
		ParentUID: "top",
	},
	{
		ID:        3,
		UID:       "sub2",
		Title:     "sub2",
		ParentUID: "sub",
	},
	{
		ID:        4,
		UID:       "sub3",
		Title:     "sub3",
		ParentUID: "sub2",
	},
}

func Test_legacyServer_Check(t *testing.T) {
	tests := []struct {
		name        string
		req         *authzv1.CheckRequest
		parents     []*folder.Folder
		userPerms   map[string][]string
		wantAllowed bool
		wantErr     bool
	}{
		{
			name: "should not allow access to a dashboard without read permission",
			req: &authzv1.CheckRequest{
				Subject:   "user:1",
				Verb:      "get",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Name:      "dash1",
				Namespace: "org-2",
			},
			userPerms:   map[string][]string{},
			wantAllowed: false,
			wantErr:     false,
		},
		{
			name: "should allow access to a dashboard with read permission",
			req: &authzv1.CheckRequest{
				Subject:   "user:1",
				Verb:      "get",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Name:      "dash1",
				Namespace: "org-2",
			},
			userPerms:   map[string][]string{"dashboards:read": {"dashboards:uid:dash1"}},
			wantAllowed: true,
			wantErr:     false,
		},
		{
			name: "should allow access to a dashboard through read permission on a parent folder",
			req: &authzv1.CheckRequest{
				Subject:   "user:1",
				Verb:      "get",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Name:      "dash1",
				Namespace: "org-2",
				Folder:    "sub4",
			},
			parents: folderTree,
			userPerms: map[string][]string{
				"dashboards:read": {"folders:uid:sub"},
			},
			wantAllowed: true,
			wantErr:     false,
		},
		{
			name: "should check action only",
			req: &authzv1.CheckRequest{
				Subject:   "user:1",
				Verb:      "get",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Namespace: "org-2",
			},
			userPerms:   map[string][]string{"dashboards:read": {"dashboards:uid:dash1"}},
			wantAllowed: true,
			wantErr:     false,
		},
		// Input validation
		{
			name: "should return error when group is not set",
			req: &authzv1.CheckRequest{
				Subject:   "user:1",
				Verb:      "get",
				Resource:  "dashboards",
				Name:      "dash1",
				Namespace: "org-2",
			},
			wantErr: true,
		},
		{
			name: "should return error when resource is not set",
			req: &authzv1.CheckRequest{
				Subject:   "user:1",
				Verb:      "get",
				Group:     "dashboard.grafana.app",
				Name:      "dash1",
				Namespace: "org-2",
			},
			wantErr: true,
		},
		{
			name: "should return error when verb is not set",
			req: &authzv1.CheckRequest{
				Subject:   "user:1",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Name:      "dash1",
				Namespace: "org-2",
			},
			wantErr: true,
		},
		{
			name: "should return error when subject is not set",
			req: &authzv1.CheckRequest{
				Verb:      "get",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Name:      "dash1",
				Namespace: "org-2",
			},
			wantErr: true,
		},
		{
			name: "should return error when namespace is incorrect",
			req: &authzv1.CheckRequest{
				Subject:   "user:1",
				Verb:      "get",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Name:      "dash1",
				Namespace: "stacks-2",
			},
			wantErr: true,
		},
		{
			name: "should return error when action is not found",
			req: &authzv1.CheckRequest{
				Subject:   "user:1",
				Verb:      "get",
				Group:     "unknown.grafana.app",
				Resource:  "unknown",
				Name:      "unknown",
				Namespace: "org-2",
			},
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := featuremgmt.WithFeatures()
			l := &legacyServer{
				ac: acimpl.ProvideAccessControl(f, nil),
				authnSvc: &authntest.FakeService{
					ExpectedIdentity: &authn.Identity{
						ID:          "user:1",
						UID:         "1",
						Type:        claims.TypeUser,
						OrgID:       2,
						OrgRoles:    map[int64]identity.RoleType{2: identity.RoleNone},
						Login:       "user1",
						Permissions: map[int64]map[string][]string{2: tt.userPerms},
					},
				},
				folderSvc: &foldertest.FakeService{ExpectedFolders: tt.parents},
				logger:    log.New("authz-grpc-server.test"),
				tracer:    tracing.InitializeTracerForTest(),
				mapper:    mappers.NewK8sRbacMapper(),
			}
			got, err := l.Check(context.Background(), tt.req)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.NotNil(t, got)
			require.Equal(t, tt.wantAllowed, got.Allowed)
		})
	}
}
