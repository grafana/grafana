package folders

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

func TestFolderAPIBuilder_getAuthorizerFunc(t *testing.T) {

	var ctx = context.Background()
	var orgID int64 = 1
	tests := []struct {
		name     string
		input    context.Context
		allow bool
	}{
		{
			name: "When creating folder should not return access denied error",
			input: identity.WithRequester(ctx, &user.SignedInUser{UserID: 1, Permissions: map[int64]map[string][]string{
				orgID: {dashboards.ActionFoldersCreate: {}, dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersAll}},
			}}),
			allow: true,
		},
	}

	b := &FolderAPIBuilder{
		gv:            resourceInfo.GroupVersion(),
		features:      nil,
		namespacer:    func(_ int64) string { return "123" },
		folderSvc:     foldertest.NewFakeService(),
		accessControl: acimpl.ProvideAccessControl(featuremgmt.WithFeatures("nestedFolders"), zanzana.NewNoopClient()),
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx, user, eval, _, _ := authorizerFunc(tt.input, authorizer.AttributesRecord{})
			ok, err := b.accessControl.Evaluate(ctx, user, eval)
			require.NoError(t, err)
			require.Equal(t, tt.allow, ok)
		})
	}
}
