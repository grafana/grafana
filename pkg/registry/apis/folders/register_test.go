package folders

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

func TestFolderAPIBuilder_GetAuthorizer(t *testing.T) {
	tests := []struct {
		name  string
		input authorizer.Authorizer
		want  authorizer.Authorizer
	}{
		{
			name: "When creating folder should not return access denied error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := &FolderAPIBuilder{
				gv:            resourceInfo.GroupVersion(),
				features:      nil,
				namespacer:    func(_ int64) string { return "123" },
				folderSvc:     foldertest.NewFakeService(),
				accessControl: acimpl.ProvideAccessControl(featuremgmt.WithFeatures("nestedFolders"), zanzana.NewNoopClient()),
			}
			got := b.GetAuthorizer()
			require.NotNil(t, got)
		})
	}
}
