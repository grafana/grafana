package authz

import (
	"testing"

	authzlib "github.com/grafana/authlib/authz"
	"github.com/stretchr/testify/require"
)

func Test_toRBAC(t *testing.T) {
	tests := []struct {
		name       string
		kind       string
		uid        string
		folder     string
		method     string
		wantAction string
		wantScope  authzlib.Resource
	}{
		{
			name:       "create",
			kind:       "dashboards",
			uid:        "",
			folder:     "",
			method:     "/entity.EntityStore/Create",
			wantAction: "dashboards:create",
			wantScope:  authzlib.Resource{},
		},
		{
			name:       "create in folder",
			kind:       "dashboards",
			uid:        "dash",
			folder:     "fold",
			method:     "/entity.EntityStore/Create",
			wantAction: "dashboards:create",
			wantScope:  authzlib.Resource{Kind: "folders", Attr: "uid", ID: "fold"},
		},
		{
			name:       "read",
			kind:       "dashboards",
			uid:        "dash",
			folder:     "",
			method:     "/entity.EntityStore/Read",
			wantAction: "dashboards:read",
			wantScope:  authzlib.Resource{Kind: "dashboards", Attr: "uid", ID: "dash"},
		},
		{
			name:       "read",
			kind:       "dashboards",
			uid:        "dash",
			folder:     "fold",
			method:     "/entity.EntityStore/Read",
			wantAction: "dashboards:read",
			wantScope:  authzlib.Resource{Kind: "folders", Attr: "uid", ID: "fold"},
			// Normally for dashboard it should be both scopes (folder and dash)
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotAction, gotScope := toRBAC(tt.kind, tt.uid, tt.folder, tt.method)
			require.Equal(t, tt.wantAction, gotAction)
			require.Equal(t, tt.wantScope, gotScope)
		})
	}
}
