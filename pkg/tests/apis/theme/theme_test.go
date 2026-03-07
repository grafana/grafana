package collections

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	themeV0 "github.com/grafana/grafana/apps/theme/pkg/apis/theme/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationThemes(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableDataMigrations: true,
		AppModeProduction:     false, // required for experimental APIs
		DisableAnonymous:      true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
		},
	})

	ctx := context.Background()
	clientV0 := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  themeV0.ThemeKind().GroupVersionResource(),
	})

	names := []string{
		"deuteranopia_protanopia_dark",
	}

	for _, name := range names {
		input := helper.LoadYAMLOrJSONFile(fmt.Sprintf("testdata/%s.json", name))
		obj, err := clientV0.Resource.Create(ctx, input, metav1.CreateOptions{})
		require.NoError(t, err)
		require.Equal(t, name, obj.GetName())
	}
}
