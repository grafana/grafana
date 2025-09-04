package serviceaccount

import (
	"context"
	"testing"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"
)

func TestMutateOnCreate_RoleAvatarUrl(t *testing.T) {
	cfg := &setting.Cfg{}
	ctx := request.WithNamespace(context.Background(), "default")

	testCases := []struct {
		name              string
		inputSA           *iamv0alpha1.ServiceAccount
		expectedRole      iamv0alpha1.ServiceAccountOrgRole
		expectedAvatarUrl string
	}{
		{
			name: "non-external sa with editor role",
			inputSA: &iamv0alpha1.ServiceAccount{
				Spec: iamv0alpha1.ServiceAccountSpec{
					Title: "My Test SA",
					Role:  iamv0alpha1.ServiceAccountOrgRoleEditor,
				},
			},
			expectedRole:      iamv0alpha1.ServiceAccountOrgRoleEditor,
			expectedAvatarUrl: dtos.GetGravatarUrlWithDefault(cfg, "", "My Test SA"),
		},
		{
			name: "external sa with admin role gets overridden to none",
			inputSA: &iamv0alpha1.ServiceAccount{
				Spec: iamv0alpha1.ServiceAccountSpec{
					Title:    "grafana-plugin-name",
					External: true,
					Role:     iamv0alpha1.ServiceAccountOrgRoleAdmin, // This should be overridden
				},
			},
			expectedRole:      iamv0alpha1.ServiceAccountOrgRoleNone,
			expectedAvatarUrl: dtos.GetGravatarUrlWithDefault(cfg, "", "extsvc-grafana-plugin-name"),
		},
		{
			name: "non-external sa with no role specified",
			inputSA: &iamv0alpha1.ServiceAccount{
				Spec: iamv0alpha1.ServiceAccountSpec{
					Title: "Another SA",
				},
			},
			expectedRole:      "", // Role is not mutated if not present and not external
			expectedAvatarUrl: dtos.GetGravatarUrlWithDefault(cfg, "", "Another SA"),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := MutateOnCreate(ctx, tc.inputSA, cfg)
			require.NoError(t, err)
			require.Equal(t, tc.expectedRole, tc.inputSA.Spec.Role)
			require.Equal(t, tc.expectedAvatarUrl, tc.inputSA.Spec.AvatarUrl)
		})
	}
}

func TestMutateOnCreate_LoginNameTitle(t *testing.T) {
	cfg := &setting.Cfg{}
	ctx := request.WithNamespace(context.Background(), "default")

	testCases := []struct {
		name          string
		inputSA       *iamv0alpha1.ServiceAccount
		expectedName  string
		expectedTitle string
		expectedLogin string
	}{
		{
			name: "non-external sa with title",
			inputSA: &iamv0alpha1.ServiceAccount{
				ObjectMeta: metav1.ObjectMeta{Name: "my-test-sa"},
				Spec:       iamv0alpha1.ServiceAccountSpec{Title: "My Test SA"},
			},
			expectedName:  "sa-1-my-test-sa",
			expectedTitle: "My Test SA",
			expectedLogin: "sa-1-my-test-sa",
		},
		{
			name: "external sa with title",
			inputSA: &iamv0alpha1.ServiceAccount{
				ObjectMeta: metav1.ObjectMeta{Name: "grafana-plugin-name"},
				Spec: iamv0alpha1.ServiceAccountSpec{
					Title:    "grafana-plugin-name",
					External: true,
				},
			},
			expectedName:  "sa-1-extsvc-grafana-plugin-name",
			expectedTitle: "extsvc-grafana-plugin-name",
			expectedLogin: "sa-1-extsvc-grafana-plugin-name",
		},
		{
			name: "non-external sa with spaces in title",
			inputSA: &iamv0alpha1.ServiceAccount{
				ObjectMeta: metav1.ObjectMeta{Name: "sa-1-sa-with-spaces"},
				Spec:       iamv0alpha1.ServiceAccountSpec{Title: "SA With Spaces"},
			},
			expectedName:  "sa-1-sa-with-spaces",
			expectedTitle: "SA With Spaces",
			expectedLogin: "sa-1-sa-with-spaces",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := MutateOnCreate(ctx, tc.inputSA, cfg)
			require.NoError(t, err)
			require.Equal(t, tc.expectedName, tc.inputSA.ObjectMeta.Name)
			require.Equal(t, tc.expectedTitle, tc.inputSA.Spec.Title)
			require.Equal(t, tc.expectedLogin, tc.inputSA.Spec.Login)
		})
	}
}
