package folder

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/xlab/treeprint"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationFolderTree(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if !db.IsTestDbSQLite() {
		t.Skip("test only on sqlite for now")
	}

	modes := []grafanarest.DualWriterMode{
		// grafanarest.Mode1, (nothing new tested in mode 0 or 1)
		grafanarest.Mode2, // write both, read legacy
		grafanarest.Mode3, // write both, read unified
		grafanarest.Mode4,
		grafanarest.Mode5,
	}
	for _, mode := range modes {
		t.Run(fmt.Sprintf("mode %d", mode), func(t *testing.T) {
			flags := []string{}
			if mode >= grafanarest.Mode3 { // make sure modes 0-3 work without it
				flags = append(flags, featuremgmt.FlagUnifiedStorageSearch)
			}
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:    true,
				DisableAnonymous:     true,
				APIServerStorageType: "unified",
				EnableFeatureToggles: flags,
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"dashboards.dashboard.grafana.app": {
						DualWriterMode: mode,
					},
					"folders.folder.grafana.app": {
						DualWriterMode: mode,
					},
				},
			})
			defer helper.Shutdown()

			tests := []struct {
				Name       string
				Definition FolderDefinition
				Expected   []ExpectedTree
			}{
				{
					Name: "admin-only-tree",
					Definition: FolderDefinition{
						Children: []FolderDefinition{
							{Name: "top",
								Creator: helper.Org1.Admin,
								Children: []FolderDefinition{
									{Name: "middle",
										Creator: helper.Org1.Admin,
										Children: []FolderDefinition{
											{Name: "child",
												Creator: helper.Org1.Admin,
											},
										},
									},
								},
							},
						},
					},
					Expected: []ExpectedTree{
						{Users: []apis.User{
							helper.Org1.Admin,
							helper.Org1.Viewer, // By default, viewer can view all dashboards
						}, Listing: `
						└── top
						....└── middle
						........└── child`},
						{Users: []apis.User{helper.Org1.None}, Listing: ``},
					},
				},
			}

			for _, tt := range tests {
				t.Run(tt.Name, func(t *testing.T) {
					tt.Definition.RequireUniqueName(t, make(map[string]bool))

					tt.Definition.CreateWithLegacyAPI(t, helper, "")
					// CreateWithLegacyAPI

					for _, expect := range tt.Expected {
						for _, user := range expect.Users {
							t.Run(fmt.Sprintf("query as %s", user.Identity.GetLogin()), func(t *testing.T) {
								legacy := getFoldersFromLegacyAPISearch(t, user)
								legacy.requireEqual(t, expect.Listing, "legacy")

								listed := getFoldersFromAPIServerList(t, user)
								listed.requireEqual(t, expect.Listing, "listed")

								search := getFoldersFromDashboardV0Search(t, user)
								search.requireEqual(t, expect.Listing, "search")

								// ensure sure GET also works on each folder we can list
								requireGettable(t, user, listed)
							})
						}
					}
				})
			}
		})
	}
}

type ExpectedTree struct {
	Users   []apis.User
	Listing string
}

type FolderDefinition struct {
	Name        string
	Creator     apis.User // The user who will create the folder
	Permissions []FolderPermission
	Children    []FolderDefinition
}

type FolderPermission struct {
	User   apis.User
	Team   team.Team
	Role   identity.RoleType
	Access dashboardaccess.PermissionType
}

func (f *FolderDefinition) CreateWithLegacyAPI(t *testing.T, h *apis.K8sTestHelper, parent string) {
	if f.Name == "" {
		require.Empty(t, parent, "only the root should be empty")
	} else {
		cfg := dynamic.ConfigFor(f.Creator.NewRestConfig())
		cfg.GroupVersion = &schema.GroupVersion{Group: "folder.grafana.app", Version: "v1beta1"} // group does not matter
		client, err := rest.RESTClientFor(cfg)
		require.NoError(t, err)

		body, err := json.Marshal(map[string]any{
			"uid":       f.Name,
			"title":     f.Name,
			"parentUid": parent,
		})
		require.NoError(t, err)

		var statusCode int
		result := client.Post().AbsPath("api", "folders").
			Body(body).
			SetHeader("Content-type", "application/json").
			Do(context.Background()).
			StatusCode(&statusCode)
		require.NoError(t, result.Error(), f.Name)
		require.Equal(t, int(http.StatusOK), statusCode, f.Name)
		parent = f.Name

		if len(f.Permissions) > 0 {
			cmd := dtos.UpdateDashboardACLCommand{}
			for _, def := range f.Permissions {
				p := dtos.DashboardACLUpdateItem{
					TeamID:     def.Team.ID, // likely zero
					Role:       &def.Role,
					Permission: def.Access,
				}
				if def.User.Identity != nil {
					p.UserID, err = def.User.Identity.GetInternalID()
					require.NoError(t, err)
				}
				cmd.Items = append(cmd.Items, p)
			}

			body, err := json.Marshal(cmd)
			require.NoError(t, err)

			var statusCode int // folders/{folder_uid}/permissions
			result = client.Post().AbsPath("api", "folders", parent, "permissions").
				Body(body).
				SetHeader("Content-type", "application/json").
				Do(context.Background()).
				StatusCode(&statusCode)
			require.NoError(t, result.Error(), f.Name)
			require.Equal(t, int(http.StatusOK), statusCode, f.Name)
		}

		// Now check that we could get the folder
		result = client.Get().AbsPath("api", "folders", f.Name).
			Do(context.Background()).
			StatusCode(&statusCode)
		require.NoErrorf(t, result.Error(), "get folder after create: %s", f.Name)
		require.Equal(t, int(http.StatusOK), statusCode, f.Name)
	}

	for _, child := range f.Children {
		child.CreateWithLegacyAPI(t, h, parent)
	}
}

func (f *FolderDefinition) CreateWithAPIServer(t *testing.T, h *apis.K8sTestHelper, parent string) {
	if f.Name == "" {
		require.Empty(t, parent, "only the root should be empty")
	} else {
		gvr := schema.GroupVersionResource{Group: "folder.grafana.app", Version: "v1beta1", Resource: "folders"}

		ns := f.Creator.Identity.GetNamespace()
		cfg := dynamic.ConfigFor(f.Creator.NewRestConfig())
		dyn, err := dynamic.NewForConfig(cfg)
		require.NoError(t, err)
		client := dyn.Resource(gvr).Namespace(ns)
		obj, err := client.Create(context.Background(), &unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]interface{}{
					"name":      f.Name,
					"namespace": ns,
					"annotations": map[string]string{
						utils.AnnoKeyFolder: parent,
					},
				},
				"spec": map[string]interface{}{
					"title": f.Name,
				},
			},
		}, v1.CreateOptions{})
		require.NoError(t, err)
		require.Equal(t, f.Name, obj.GetName())
	}

	for _, child := range f.Children {
		child.CreateWithAPIServer(t, h, parent)
	}
}

func (f *FolderDefinition) RequireUniqueName(t *testing.T, names map[string]bool) {
	if f.Name != "" && names[f.Name] {
		t.Fatalf("duplicate name: %s", f.Name)
	}
	names[f.Name] = true
	for _, child := range f.Children {
		child.RequireUniqueName(t, names)
	}
}

type FolderView struct {
	Name     string
	Parent   string
	Title    string
	Children []*FolderView
}

func (n *FolderView) forEach(cb func(*FolderView)) {
	for _, child := range n.Children {
		cb(child)
	}
}

func (n *FolderView) requireEqual(t *testing.T, expect string, msg string) {
	input := strings.Split(expect, "\n")
	output := make([]string, 0, len(input))
	for _, v := range input {
		v = strings.TrimSpace(v)
		if len(v) > 0 {
			output = append(output, v)
		}
	}
	expect = strings.Join(output, "\n")
	found := dotify(n.build(treeprint.New()))
	require.Equal(t, expect, found, fmt.Sprintf("%s // EXPECT:\n%s\n\nFOUND:\n%s", msg, expect, found))
}

func (n *FolderView) build(tree treeprint.Tree) treeprint.Tree {
	for _, child := range n.Children {
		child.build(tree.AddBranch(child.Name))
	}
	return tree
}

func getFoldersFromLegacyAPISearch(t *testing.T, who apis.User) *FolderView {
	cfg := dynamic.ConfigFor(who.NewRestConfig())
	cfg.GroupVersion = &schema.GroupVersion{Group: "folder.grafana.app", Version: "v1beta1"} // group does not matter
	client, err := rest.RESTClientFor(cfg)
	require.NoError(t, err)

	var statusCode int
	result := client.Get().AbsPath("api", "search").
		Param("type", "dash-folder").
		Param("limit", "1000").
		Do(context.Background()).
		StatusCode(&statusCode)
	require.NoError(t, result.Error(), "getting folders with /api/search")
	require.Equal(t, int(http.StatusOK), statusCode)

	body, err := result.Raw()
	require.NoError(t, err)
	hits := model.HitList{}
	err = json.Unmarshal(body, &hits)
	require.NoError(t, err)

	lookup := make(map[string]*FolderView, len(hits))
	for _, hit := range hits {
		lookup[hit.UID] = &FolderView{
			Name:   hit.UID,
			Title:  hit.Title,
			Parent: hit.FolderUID,
		}
	}
	return makeRoot(t, lookup, "/api/search")
}

func makeRoot(t *testing.T, lookup map[string]*FolderView, name string) *FolderView {
	root := &FolderView{}
	for _, v := range lookup {
		if v.Parent == "" {
			root.Children = append(root.Children, v)
		} else {
			p, ok := lookup[v.Parent]
			require.Truef(t, ok, "[%s] parent not found for: %s (parent:%s)", name, v.Name, v.Parent)
			p.Children = append(p.Children, v)
		}
	}
	return root
}

func getFoldersFromDashboardV0Search(t *testing.T, who apis.User) *FolderView {
	cfg := dynamic.ConfigFor(who.NewRestConfig())
	cfg.GroupVersion = &schema.GroupVersion{Group: "dashboard.grafana.app", Version: "v0alpha1"} // group does not matter
	client, err := rest.RESTClientFor(cfg)
	require.NoError(t, err)

	var statusCode int
	result := client.Get().AbsPath("apis", "dashboard.grafana.app", "v0alpha1", "namespaces", who.Identity.GetNamespace(), "search").
		Param("limit", "1000").
		Do(context.Background()).
		StatusCode(&statusCode)
	err = result.Error()
	if err != nil {
		if apierrors.IsForbidden(err) {
			return &FolderView{} // empty list
		}
		require.NoError(t, err, "getting folders with /apis/dashboard.grafana.app/v0alpha1/.../search")
	}
	require.Equal(t, int(http.StatusOK), statusCode)

	body, err := result.Raw()
	require.NoError(t, err)
	results := &dashboardV0.SearchResults{}
	err = json.Unmarshal(body, &results)
	require.NoError(t, err)

	lookup := make(map[string]*FolderView, len(results.Hits))
	for _, hit := range results.Hits {
		lookup[hit.Name] = &FolderView{
			Name:   hit.Name,
			Title:  hit.Title,
			Parent: hit.Folder,
		}
	}

	return makeRoot(t, lookup, "dashboards/search")
}

func getFoldersFromAPIServerList(t *testing.T, who apis.User) *FolderView {
	gvr := schema.GroupVersionResource{Group: "folder.grafana.app", Version: "v1beta1", Resource: "folders"}

	ns := who.Identity.GetNamespace()
	cfg := dynamic.ConfigFor(who.NewRestConfig())
	dyn, err := dynamic.NewForConfig(cfg)
	require.NoError(t, err)
	client := dyn.Resource(gvr).Namespace(ns)

	lookup := map[string]*FolderView{}
	continueToken := ""
	for {
		result, err := client.List(context.Background(), v1.ListOptions{Limit: 1000, Continue: continueToken})
		if apierrors.IsForbidden(err) {
			return &FolderView{} // empty list
		}
		require.NoError(t, err)

		for _, hit := range result.Items {
			obj, err := utils.MetaAccessor(&hit)
			require.NoError(t, err)

			title, _, err := unstructured.NestedString(hit.Object, "spec", "title")
			require.NoError(t, err)

			lookup[hit.GetName()] = &FolderView{
				Name:   hit.GetName(),
				Title:  title,
				Parent: obj.GetFolder(),
			}
		}

		continueToken = result.GetContinue()
		if continueToken == "" {
			break
		}
	}

	return makeRoot(t, lookup, "folders/list")
}

func requireGettable(t *testing.T, who apis.User, root *FolderView) {
	gvr := schema.GroupVersionResource{Group: "folder.grafana.app", Version: "v1beta1", Resource: "folders"}

	ns := who.Identity.GetNamespace()
	cfg := dynamic.ConfigFor(who.NewRestConfig())
	dyn, err := dynamic.NewForConfig(cfg)
	require.NoError(t, err)
	client := dyn.Resource(gvr).Namespace(ns)

	root.forEach(func(fv *FolderView) {
		found, err := client.Get(context.Background(), fv.Name, v1.GetOptions{})
		require.NoErrorf(t, err, "getting folder: %s", fv.Name)
		require.Equal(t, found.GetName(), fv.Name)
	})
}

func dotify(t treeprint.Tree) string {
	buff := bytes.Buffer{}
	for _, line := range strings.Split(t.String(), "\n") {
		if line == "." || line == " " || len(line) == 0 {
			continue
		}
		runes := []rune(line)
		for j, r := range runes {
			if r == rune(' ') {
				runes[j] = '.'
				continue
			}
			break
		}
		if buff.Len() > 0 {
			buff.WriteRune('\n')
		}
		buff.WriteString(string(runes))
	}
	return buff.String()
}
