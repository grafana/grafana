package serviceaccount

import (
	"context"
	"testing"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"
)

func TestMutateOnCreate(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "default")

	testCases := []struct {
		name         string
		inputSA      *iamv0alpha1.ServiceAccount
		expectedRole iamv0alpha1.ServiceAccountOrgRole
	}{
		{
			name: "non-external sa with editor role",
			inputSA: &iamv0alpha1.ServiceAccount{
				Spec: iamv0alpha1.ServiceAccountSpec{
					Title: "My Test SA",
					Role:  iamv0alpha1.ServiceAccountOrgRoleEditor,
				},
			},
			expectedRole: iamv0alpha1.ServiceAccountOrgRoleEditor,
		},
		{
			name: "external sa with admin role is not overridden",
			inputSA: &iamv0alpha1.ServiceAccount{
				Spec: iamv0alpha1.ServiceAccountSpec{
					Title:  "grafana-plugin-name",
					Plugin: "grafana-plugin-name",
					Role:   iamv0alpha1.ServiceAccountOrgRoleAdmin,
				},
			},
			expectedRole: iamv0alpha1.ServiceAccountOrgRoleAdmin,
		},
		{
			name: "external sa with no role specified gets none",
			inputSA: &iamv0alpha1.ServiceAccount{
				Spec: iamv0alpha1.ServiceAccountSpec{
					Title:  "sa-1-extsvc-grafana-plugin-name",
					Plugin: "grafana-plugin-name",
				},
			},
			expectedRole: iamv0alpha1.ServiceAccountOrgRoleNone,
		},
		{
			name: "non-external sa with no role specified",
			inputSA: &iamv0alpha1.ServiceAccount{
				Spec: iamv0alpha1.ServiceAccountSpec{
					Title: "Another SA",
				},
			},
			expectedRole: "", // Role is not mutated if not present and not external
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := MutateOnCreate(ctx, tc.inputSA)
			require.NoError(t, err)
			require.Equal(t, tc.expectedRole, tc.inputSA.Spec.Role)
		})
	}
}
