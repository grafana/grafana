package folder

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	"github.com/stretchr/testify/require"
	"github.com/xlab/treeprint"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
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

func (n *FolderView) build(node *treeprint.Node) {
	for _, child := range n.Children {
		child.build(node.AddBranch(child.Name))
	}
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

func GetFoldersFromSearch(t *testing.T, who apis.User) FolderView {
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

	root := FolderView{}
	for _, v := range lookup {
		if v.Parent == "" {
			root.Children = append(root.Children, v)
		} else {
			p, ok := lookup[v.Parent]
			require.True(t, ok, "parent not found for", v)
			p.Children = append(p.Children, v)
		}
	}

	tree := treeprint.New()

	return root
}
