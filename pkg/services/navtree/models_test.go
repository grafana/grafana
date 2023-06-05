package navtree

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNavTreeRoot(t *testing.T) {
	t.Run("Should remove empty admin and server admin sections", func(t *testing.T) {
		treeRoot := NavTreeRoot{
			Children: []*NavLink{
				{Id: NavIDCfg},
				{Id: NavIDAdmin},
			},
		}

		treeRoot.RemoveEmptySectionsAndApplyNewInformationArchitecture()

		require.Equal(t, 0, len(treeRoot.Children))
	})

	t.Run("Should create 3 new sections in the Admin node", func(t *testing.T) {
		treeRoot := NavTreeRoot{
			Children: []*NavLink{
				{Id: NavIDCfg},
				{Id: NavIDAdmin, Children: []*NavLink{{Id: "upgrading"}, {Id: "plugins"}, {Id: "teams"}}},
			},
		}

		treeRoot.RemoveEmptySectionsAndApplyNewInformationArchitecture()

		require.Equal(t, "Administration", treeRoot.Children[0].Text)
	})

	t.Run("Should move reports into Dashboards", func(t *testing.T) {
		treeRoot := NavTreeRoot{
			Children: []*NavLink{
				{Id: NavIDDashboards},
				{Id: NavIDReporting},
			},
		}

		treeRoot.RemoveEmptySectionsAndApplyNewInformationArchitecture()

		require.Equal(t, NavIDReporting, treeRoot.Children[0].Children[0].Id)
	})

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
}
