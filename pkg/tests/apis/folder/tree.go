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
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/tests/apis"
)

type TestingFolder struct {
	Name        string
	Creator     apis.User // The user who will create the folder
	Permissions []FolderPermission
	Children    []TestingFolder
}

type FolderPermission struct {
	User   apis.User
	Team   team.Team
	Role   identity.RoleType
	Access dashboardaccess.PermissionType
}

func (f *TestingFolder) CreateUsingLegacyAPI(t *testing.T, h *apis.K8sTestHelper, parent string) {
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
	}

	for _, child := range f.Children {
		child.CreateUsingLegacyAPI(t, h, parent)
	}
}

func (f *TestingFolder) RequireUniqueName(t *testing.T, names map[string]bool) {
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

func (n *FolderView) requireEqual(t *testing.T, tree *FolderView) {
	expect := dotify(tree.build(treeprint.New()))
	found := dotify(n.build(treeprint.New()))
	require.Equal(t, expect, found, fmt.Sprintf("EXPECT:\n%s\n\nFOUND:\n%s", expect, found))
}

func (n *FolderView) requireEqualTree(t *testing.T, expect string) {
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
	require.Equal(t, expect, found, fmt.Sprintf("EXPECT:\n%s\n\nFOUND:\n%s", expect, found))
}

func (n *FolderView) build(tree treeprint.Tree) treeprint.Tree {
	for _, child := range n.Children {
		child.build(tree.AddBranch(child.Name))
	}
	return tree
}

func (n *FolderView) String() string {
	buf := new(bytes.Buffer)
	if n.Name != "" {
		return "only valid at the root"
	}
	n.write(buf, 0)
	return buf.String()
}

func (n *FolderView) write(out *bytes.Buffer, level int) {
	if n.Name != "" {
		fmt.Fprintf(out, "%s (%s)\n", n.Name, n.Title)
	}
	for i, child := range n.Children {
		for range level {
			out.WriteString("   ")
		}
		if i+1 == len(n.Children) {
			out.Write([]byte(EdgeTypeEnd))
		} else {
			out.Write([]byte(EdgeTypeMid))
		}
		child.write(out, level+1)
	}
}

type EdgeType string

var (
	EdgeTypeLink EdgeType = "│"
	EdgeTypeMid  EdgeType = "├─-"
	EdgeTypeEnd  EdgeType = "└──"
)

func GetFoldersFromLegacyAPISearch(t *testing.T, who apis.User) *FolderView {
	cfg := dynamic.ConfigFor(who.NewRestConfig())
	cfg.GroupVersion = &schema.GroupVersion{Group: "folder.grafana.app", Version: "v1beta1"} // group does not matter
	client, err := rest.RESTClientFor(cfg)
	require.NoError(t, err)

	var statusCode int
	result := client.Get().AbsPath("api", "search").
		Param("type", "dash-folder"). // &limit=1000"
		Param("limit", "1000").
		Do(context.Background()).
		StatusCode(&statusCode)
	require.NoError(t, result.Error(), "getting folders")
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

	root := &FolderView{}
	for _, v := range lookup {
		if v.Parent == "" {
			root.Children = append(root.Children, v)
		} else {
			p, ok := lookup[v.Parent]
			require.True(t, ok, "parent not found for", v)
			p.Children = append(p.Children, v)
		}
	}
	return root
}

func GetFoldersFromAPIServerList(t *testing.T, who apis.User) *FolderView {
	gvr := schema.GroupVersionResource{Group: "folder.grafana.app", Version: "v1beta1", Resource: "folders"}
	cfg := dynamic.ConfigFor(who.NewRestConfig())
	dyn, err := dynamic.NewForConfig(cfg)
	require.NoError(t, err)
	client := dyn.Resource(gvr).Namespace(who.Identity.GetNamespace())

	result, err := client.List(context.Background(), v1.ListOptions{Limit: 1000})
	require.NoError(t, err)

	lookup := make(map[string]*FolderView, len(result.Items))
	for _, hit := range result.Items {
		obj, err := utils.MetaAccessor(hit)
		require.NoError(t, err)

		title, _, err := unstructured.NestedString(hit.Object, "spec", "title")
		require.NoError(t, err)

		lookup[hit.GetName()] = &FolderView{
			Name:   hit.GetName(),
			Title:  title,
			Parent: obj.GetFolder(),
		}
	}

	root := &FolderView{}
	for _, v := range lookup {
		if v.Parent == "" {
			root.Children = append(root.Children, v)
		} else {
			p, ok := lookup[v.Parent]
			require.True(t, ok, "parent not found for", v)
			p.Children = append(p.Children, v)
		}
	}
	return root
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
