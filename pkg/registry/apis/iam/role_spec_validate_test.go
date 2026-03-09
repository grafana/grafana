package iam

import (
	"testing"

	"github.com/stretchr/testify/require"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

func TestValidateGlobalRoleSpec(t *testing.T) {
	tests := []struct {
		name    string
		gr      *iamv0.GlobalRole
		wantErr bool
	}{
		{
			name: "no roleRefs allowed",
			gr: &iamv0.GlobalRole{
				Spec: iamv0.GlobalRoleSpec{
					RoleRefs: []iamv0.GlobalRolespecRoleRef{
						{Kind: "GlobalRole", Name: "basic_viewer"},
					},
				},
			},
			wantErr: true,
		},
		{
			name: "empty roleRefs allowed",
			gr: &iamv0.GlobalRole{
				Spec: iamv0.GlobalRoleSpec{
					RoleRefs: []iamv0.GlobalRolespecRoleRef{},
				},
			},
			wantErr: false,
		},
		{
			name: "nil roleRefs allowed",
			gr: &iamv0.GlobalRole{
				Spec: iamv0.GlobalRoleSpec{},
			},
			wantErr: false,
		},
		{
			name: "permissionsOmitted not allowed",
			gr: &iamv0.GlobalRole{
				Spec: iamv0.GlobalRoleSpec{
					PermissionsOmitted: []iamv0.GlobalRolespecPermission{
						{Action: "dashboards:read", Scope: "dashboards:*"},
					},
				},
			},
			wantErr: true,
		},
		{
			name: "empty permissionsOmitted allowed",
			gr: &iamv0.GlobalRole{
				Spec: iamv0.GlobalRoleSpec{
					PermissionsOmitted: []iamv0.GlobalRolespecPermission{},
				},
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateGlobalRoleSpec(tt.gr)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestValidateRoleSpec(t *testing.T) {
	tests := []struct {
		name    string
		r       *iamv0.Role
		wantErr bool
	}{
		{
			name: "no roleRefs allowed",
			r: &iamv0.Role{
				Spec: iamv0.RoleSpec{
					RoleRefs: nil,
				},
			},
			wantErr: false,
		},
		{
			name: "empty roleRefs allowed",
			r: &iamv0.Role{
				Spec: iamv0.RoleSpec{
					RoleRefs: []iamv0.RolespecRoleRef{},
				},
			},
			wantErr: false,
		},
		{
			name: "GlobalRole Viewer allowed",
			r: &iamv0.Role{
				Spec: iamv0.RoleSpec{
					RoleRefs: []iamv0.RolespecRoleRef{
						{Kind: "GlobalRole", Name: "basic_viewer"},
					},
				},
			},
			wantErr: false,
		},
		{
			name: "GlobalRole Editor allowed",
			r: &iamv0.Role{
				Spec: iamv0.RoleSpec{
					RoleRefs: []iamv0.RolespecRoleRef{
						{Kind: "GlobalRole", Name: "basic_editor"},
					},
				},
			},
			wantErr: false,
		},
		{
			name: "Role kind not allowed",
			r: &iamv0.Role{
				Spec: iamv0.RoleSpec{
					RoleRefs: []iamv0.RolespecRoleRef{
						{Kind: "Role", Name: "custom-role"},
					},
				},
			},
			wantErr: true,
		},
		{
			name: "CoreRole kind not allowed",
			r: &iamv0.Role{
				Spec: iamv0.RoleSpec{
					RoleRefs: []iamv0.RolespecRoleRef{
						{Kind: "CoreRole", Name: "Viewer"},
					},
				},
			},
			wantErr: true,
		},
		{
			name: "non-basic role name not allowed",
			r: &iamv0.Role{
				Spec: iamv0.RoleSpec{
					RoleRefs: []iamv0.RolespecRoleRef{
						{Kind: "GlobalRole", Name: "CustomRole"},
					},
				},
			},
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateRoleSpec(tt.r)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}
