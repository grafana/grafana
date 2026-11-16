package testcases

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"
	dashV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/tests/apis"
)

// libraryPanelsTestCase tests the "librarypanels" ResourceMigration.
type libraryPanelsTestCase struct {
	uids    []string
	richUID string
}

// NewLibraryPanelsTestCase creates a test case for the library panels migrator
func NewLibraryPanelsTestCase() ResourceMigratorTestCase {
	return &libraryPanelsTestCase{
		uids: []string{},
	}
}

func (tc *libraryPanelsTestCase) Name() string {
	return "librarypanels"
}

func (tc *libraryPanelsTestCase) FeatureToggles() []string {
	return nil
}

func (tc *libraryPanelsTestCase) RenameTables() []string {
	return []string{}
}

func (tc *libraryPanelsTestCase) Resources() []schema.GroupVersionResource {
	return []schema.GroupVersionResource{
		dashV0.LibraryPanelResourceInfo.GroupVersionResource(),
	}
}

func (tc *libraryPanelsTestCase) AddLegacySQLMigrations(mg *migrator.Migrator) {
	// library_element is still created on startup, nothing to add
}

func (tc *libraryPanelsTestCase) Setup(t *testing.T, helper *apis.K8sTestHelper) bool {
	t.Helper()

	sqlDB := helper.GetEnv().SQLStore
	cfg := helper.GetEnv().Cfg

	libraryElements := libraryelements.ProvideService(cfg, sqlDB, nil, nil, nil,
		&alwaysYesAccessControl{}, nil, nil, nil)

	// root-level library panels: folders have their own migration and test case
	for _, name := range []string{"lp-mig-test-1", "lp-mig-test-2", "lp-mig-test-3"} {
		uid := createTestLibraryPanel(t, helper, libraryElements, name, "")
		tc.uids = append(tc.uids, uid)
	}
	// Keep the library panel name distinct from its displayed panel title and
	// include both typed and untyped model fields to exercise the SQL-to-API mapping.
	panelModel := json.RawMessage(`{
		"type": "text",
		"title": "Displayed panel title",
		"description": "Migration model round trip",
		"options": {"mode": "markdown", "content": "Migrated content"},
		"transformations": [{"id": "organize", "options": {"excludeByName": {"hidden": true}}}]
	}`)
	// The folders/dashboards case creates this legacy folder earlier in the suite.
	folderUID := "child-folder-uid"
	rich, err := libraryElements.CreateElement(context.Background(), helper.Org1.Admin.Identity,
		model.CreateLibraryElementCommand{
			Name:      "Library panel name",
			Kind:      1,
			FolderUID: &folderUID,
			Model:     panelModel,
		})
	require.NoError(t, err)
	tc.richUID = rich.UID
	tc.uids = append(tc.uids, rich.UID)

	return true // library panels are served over k8s apis, reading from legacy in Mode0
}

func (tc *libraryPanelsTestCase) Verify(t *testing.T, helper *apis.K8sTestHelper, shouldExist bool) {
	t.Helper()

	namespace := authlib.OrgNamespaceFormatter(helper.Org1.OrgID)
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: namespace,
		GVR:       dashV0.LibraryPanelResourceInfo.GroupVersionResource(),
	})

	// No total-count assertion: the folders/dashboards test case creates a library
	// panel in the same org and the librarypanels migration moves that one too.
	for _, uid := range tc.uids {
		verifyResource(t, client, uid, shouldExist)
	}
	if !shouldExist {
		return
	}

	got, err := client.Resource.Get(context.Background(), tc.richUID, metav1.GetOptions{})
	require.NoError(t, err)
	data, err := got.MarshalJSON()
	require.NoError(t, err)
	var panel dashV0.LibraryPanel
	require.NoError(t, json.Unmarshal(data, &panel))
	require.Equal(t, "Library panel name", panel.Spec.Title)
	require.Equal(t, "Displayed panel title", panel.Spec.PanelTitle)
	require.Equal(t, "Migration model round trip", panel.Spec.Description)
	require.Equal(t, "text", panel.Spec.Type)
	require.Equal(t, "Migrated content", panel.Spec.Options.Object["content"])
	require.Equal(t, "markdown", panel.Spec.Options.Object["mode"])
	meta, err := utils.MetaAccessor(&panel)
	require.NoError(t, err)
	require.Equal(t, "child-folder-uid", meta.GetFolder())
	require.Equal(t, []any{map[string]any{
		"id":      "organize",
		"options": map[string]any{"excludeByName": map[string]any{"hidden": true}},
	}}, panel.Status.Missing.Object["transformations"])
}
