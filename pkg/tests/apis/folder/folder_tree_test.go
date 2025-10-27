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
	folderV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/search/model"
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
		grafanarest.Mode0, // legacy only
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
												Permissions: []FolderPermission{{
													Permission: "View",
													User:       helper.Org1.None,
												}},
											},
										},
									},
								},
							},
						},
					},
					Expected: []ExpectedTree{
						{User: helper.Org1.Admin, Listing: `
						└── top (admin,edit,save,delete)
						....└── middle (admin,edit,save,delete)
						........└── child (admin,edit,save,delete)`},
						{User: helper.Org1.Viewer, Listing: `
						└── top (view)
						....└── middle (view)
						........└── child (view)`},
						{User: helper.Org1.None, Listing: `
						└── sharedwithme (???)
						....└── child (view)`,
							E403: []string{"top", "middle"},
						},
					},
				},
			}

			var statusCode int
			for _, tt := range tests {
				t.Run(tt.Name, func(t *testing.T) {
					tt.Definition.RequireUniqueName(t, make(map[string]bool))

					tt.Definition.CreateWithLegacyAPI(t, helper, "")
					// CreateWithLegacyAPI

					for _, expect := range tt.Expected {
						unstructured, client := getFolderClients(t, expect.User)
						t.Run(fmt.Sprintf("query as %s", expect.User.Identity.GetLogin()), func(t *testing.T) {
							legacy := getFoldersFromLegacyAPISearch(t, client)
							legacy.requireEqual(t, expect.Listing, "legacy")

							listed := getFoldersFromAPIServerList(t, unstructured)
							listed.requireEqual(t, expect.Listing, "listed")

							search := getFoldersFromDashboardV0Search(t, client, expect.User.Identity.GetNamespace())
							search.requireEqual(t, expect.Listing, "search")

							// ensure sure GET also works on each folder we can list
							listed.forEach(func(fv *FolderView) {
								if fv.Name == folder.SharedWithMeFolderUID {
									return // skip it
								}
								found, err := unstructured.Get(context.Background(), fv.Name, v1.GetOptions{})
								require.NoErrorf(t, err, "getting folder: %s", fv.Name)
								require.Equal(t, found.GetName(), fv.Name)
							})

							// Forbidden things should really be hidden
							for _, name := range expect.E403 {
								_, err := unstructured.Get(context.Background(), name, v1.GetOptions{})
								require.Error(t, err)
								require.Truef(t, apierrors.IsForbidden(err), "error: %w", err) // 404 vs 403 ????

								result := client.Get().AbsPath("api", "folders", name).
									Do(context.Background()).
									StatusCode(&statusCode)
								require.Equal(t, int(http.StatusForbidden), statusCode)
								require.Error(t, result.Error())

								// Verify sub-resources are hidden
								for _, sub := range []string{"access", "parents", "children", "counts"} {
									_, err := unstructured.Get(context.Background(), name, v1.GetOptions{}, sub)
									require.Error(t, err, "expect error for subresource", sub)
									require.Truef(t, apierrors.IsForbidden(err), "error: %w", err) // 404 vs 403 ????
								}

								// Verify legacy API access is also hidden
								for _, sub := range []string{"permissions", "counts"} {
									result := client.Get().AbsPath("api", "folders", name, sub).
										Do(context.Background()).
										StatusCode(&statusCode)
									require.Equalf(t, int(http.StatusForbidden), statusCode, "legacy access to: %s", sub)
									require.Error(t, result.Error())
								}
							}
						})
					}
				})
			}
		})
	}
}

type ExpectedTree struct {
	User    apis.User
	Listing string
	E403    []string
}

type FolderDefinition struct {
	Name        string
	Creator     apis.User // The user who will create the folder
	Permissions []FolderPermission
	Children    []FolderDefinition
}

type FolderPermission struct {
	Permission string
	User       apis.User
	// Team       team.Team
	// Role       identity.RoleType
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
			for _, def := range f.Permissions {
				// http://localhost:3000/api/access-control/folders/feyx0ezuwqwowb/users/aeyx0jzgix9fkd
				body = []byte(`{"permission": "` + def.Permission + `"}`)
				require.NotEmpty(t, def.Permission, "invalid permission: %+v", def)
				if def.User.Identity != nil {
					result = client.Post().AbsPath(
						"api", "access-control", "folders", f.Name, "users", def.User.Identity.GetIdentifier()).
						Body(body).
						SetHeader("Content-type", "application/json").
						Do(context.Background()).
						StatusCode(&statusCode)
					err = result.Error()
					require.NoErrorf(t, err, "legacy access control: %s: %s", f.Name, body)
					require.Equal(t, int(http.StatusOK), statusCode, f.Name)
				}
			}
		}
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
	Access   *folderV1.FolderAccessInfo
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

func accessDescription(access *folderV1.FolderAccessInfo) string {
	if access == nil {
		return "???"
	}
	perms := []string{}
	if access.CanAdmin {
		perms = append(perms, "admin")
	}
	if access.CanEdit {
		perms = append(perms, "edit")
	}
	if access.CanSave {
		perms = append(perms, "save")
	}
	if access.CanDelete {
		perms = append(perms, "delete")
	}
	if len(perms) == 0 {
		return "view" // because it was not nil!
	}
	return strings.Join(perms, ",")
}

func (n *FolderView) build(tree treeprint.Tree) treeprint.Tree {
	for _, child := range n.Children {
		child.build(tree.AddBranch(fmt.Sprintf("%s (%s)", child.Name, accessDescription(child.Access))))
	}
	return tree
}

func getFoldersFromLegacyAPISearch(t *testing.T, client *rest.RESTClient) *FolderView {
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
		fv := &FolderView{
			Name:   hit.UID,
			Title:  hit.Title,
			Parent: hit.FolderUID,
		}

		// Read the access info (note not the same model but the fields we care about do overlap)
		result = client.Get().AbsPath("api", "folders", hit.UID).
			Do(context.Background()).
			StatusCode(&statusCode)
		require.NoError(t, result.Error(), "getting folder access info (/api)")
		require.Equal(t, int(http.StatusOK), statusCode)

		body, err := result.Raw()
		require.NoError(t, err)
		err = json.Unmarshal(body, &fv.Access)
		require.NoError(t, err)

		lookup[hit.UID] = fv
	}
	return makeRoot(lookup, "/api/search")
}

func makeRoot(lookup map[string]*FolderView, name string) *FolderView {
	shared := &FolderView{} // when not found
	root := &FolderView{}
	for _, v := range lookup {
		if v.Parent == "" {
			root.Children = append(root.Children, v)
		} else {
			p, ok := lookup[v.Parent]
			if ok {
				p.Children = append(p.Children, v)
			} else {
				shared.Children = append(shared.Children, v)
			}
		}
	}
	if len(shared.Children) > 0 {
		shared.Name = folder.SharedWithMeFolderUID
		root.Children = append([]*FolderView{shared}, root.Children...)
	}
	return root
}

func getFoldersFromDashboardV0Search(t *testing.T, client *rest.RESTClient, ns string) *FolderView {
	var statusCode int
	result := client.Get().AbsPath("apis", "dashboard.grafana.app", "v0alpha1", "namespaces", ns, "search").
		Param("limit", "1000").
		Do(context.Background()).
		StatusCode(&statusCode)
	err := result.Error()
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
		fv := &FolderView{
			Name:   hit.Name,
			Title:  hit.Title,
			Parent: hit.Folder,
		}

		result = client.Get().AbsPath("apis", folderV1.APIGroup,
			folderV1.APIVersion, "namespaces", ns, "folders", hit.Name, "access").
			Do(context.Background()).
			StatusCode(&statusCode)
		require.NoError(t, result.Error(), "getting folder access info (/access)")
		require.Equal(t, int(http.StatusOK), statusCode)

		body, err := result.Raw()
		require.NoError(t, err)
		err = json.Unmarshal(body, &fv.Access)
		require.NoError(t, err)

		lookup[hit.Name] = fv
	}

	return makeRoot(lookup, "dashboards/search")
}

func getFolderClients(t *testing.T, who apis.User) (dynamic.ResourceInterface, *rest.RESTClient) {
	gvr := schema.GroupVersionResource{Group: folderV1.APIGroup, Version: folderV1.APIVersion, Resource: "folders"}
	ns := who.Identity.GetNamespace()
	cfg := dynamic.ConfigFor(who.NewRestConfig())
	dyn, err := dynamic.NewForConfig(cfg)
	require.NoError(t, err)
	dc := dyn.Resource(gvr).Namespace(ns)

	cfg.GroupVersion = &schema.GroupVersion{Group: gvr.Group, Version: gvr.Version}
	client, err := rest.RESTClientFor(cfg)
	require.NoError(t, err)
	return dc, client
}

func getFoldersFromAPIServerList(t *testing.T, client dynamic.ResourceInterface) *FolderView {
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

			fv := &FolderView{
				Name:   hit.GetName(),
				Title:  title,
				Parent: obj.GetFolder(),
			}

			access, err := client.Get(context.Background(), fv.Name, v1.GetOptions{}, "access")
			require.NoError(t, err)
			jj, err := json.Marshal(access)
			require.NoError(t, err)
			err = json.Unmarshal(jj, &fv.Access)
			require.NoError(t, err)

			lookup[fv.Name] = fv
		}

		continueToken = result.GetContinue()
		if continueToken == "" {
			break
		}
	}

	return makeRoot(lookup, "folders/list")
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
