package authz

import (
	"testing"

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
		wantScope  string
	}{
		{
			name:       "create",
			kind:       "dashboards",
			uid:        "",
			folder:     "",
			method:     "/entity.EntityStore/Create",
			wantAction: "dashboards:create",
			wantScope:  "",
		},
		{
			name:       "create in folder",
			kind:       "dashboards",
			uid:        "dash",
			folder:     "fold",
			method:     "/entity.EntityStore/Create",
			wantAction: "dashboards:create",
			wantScope:  "folders:uid:fold",
		},
		{
			name:       "read",
			kind:       "dashboards",
			uid:        "dash",
			folder:     "",
			method:     "/entity.EntityStore/Read",
			wantAction: "dashboards:read",
			wantScope:  "dashboards:uid:dash",
		},
		{
			name:       "read",
			kind:       "dashboards",
			uid:        "dash",
			folder:     "fold",
			method:     "/entity.EntityStore/Read",
			wantAction: "dashboards:read",
			wantScope:  "folders:uid:fold",
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
