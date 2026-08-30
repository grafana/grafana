package navtree

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNavTreeRoot(t *testing.T) {
	t.Run("Sorting by index", func(t *testing.T) {
		treeRoot := NavTreeRoot{
			Children: []*NavLink{
				{Id: "1"},
				{Id: "2"},
				{Id: "3"},
			},
		}
		treeRoot.Sort()
		require.Equal(t, "1", treeRoot.Children[0].Id)
		require.Equal(t, "3", treeRoot.Children[2].Id)
	})

	t.Run("Sorting by index and SortWeight", func(t *testing.T) {
		treeRoot := NavTreeRoot{
			Children: []*NavLink{
				{Id: "1"},
				{Id: "2"},
				{Id: "3"},
				{Id: "4", SortWeight: 1},
			},
		}
		treeRoot.Sort()
		require.Equal(t, "1", treeRoot.Children[0].Id)
		require.Equal(t, "4", treeRoot.Children[1].Id)
	})
	t.Run("FindByURL is able to find a navItem by url", func(t *testing.T) {
		treeRoot := NavTreeRoot{
			Children: []*NavLink{
				{Id: "1", Url: "/"},
				{Id: "2", Url: "/org"},
				{Id: "3", Url: "/org/users"},
			},
		}
		require.Equal(t, "2", treeRoot.FindByURL("/org").Id)
		require.Equal(t, "3", treeRoot.FindByURL("/org/users").Id)
	})

	t.Run("RemoveEmptyAdminSections removes empty admin subsections", func(t *testing.T) {
		treeRoot := NavTreeRoot{
			Children: []*NavLink{
				{Id: NavIDCfg, Children: []*NavLink{
					{Id: NavIDCfgGeneral},
					{Id: NavIDCfgPlugins},
					{Id: NavIDCfgAccess},
				}},
			},
		}
		treeRoot.RemoveEmptyAdminSections()
		require.Nil(t, treeRoot.FindById(NavIDCfgGeneral))
		require.Nil(t, treeRoot.FindById(NavIDCfgPlugins))
		require.Nil(t, treeRoot.FindById(NavIDCfgAccess))
		require.Nil(t, treeRoot.FindById(NavIDCfg))
	})

	t.Run("RemoveEmptyAdminSections keeps subsections populated by hooks", func(t *testing.T) {
		treeRoot := NavTreeRoot{
			Children: []*NavLink{
				{Id: NavIDCfg, Children: []*NavLink{
					{Id: NavIDCfgGeneral, Children: []*NavLink{{Id: "banner-settings"}}},
					{Id: NavIDCfgPlugins},
				}},
			},
		}
		treeRoot.RemoveEmptyAdminSections()
		require.NotNil(t, treeRoot.FindById(NavIDCfgGeneral))
		require.Nil(t, treeRoot.FindById(NavIDCfgPlugins))
		require.NotNil(t, treeRoot.FindById(NavIDCfg))
	})
}
