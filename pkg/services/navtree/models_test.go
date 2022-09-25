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

		treeRoot.RemoveEmptySectionsAndApplyNewInformationArchitecture(false)

		require.Equal(t, 0, len(treeRoot.Children))
	})

	t.Run("Should not remove admin sections when they have children", func(t *testing.T) {
		treeRoot := NavTreeRoot{
			Children: []*NavLink{
				{Id: NavIDCfg, Children: []*NavLink{{Id: "child"}}},
				{Id: NavIDAdmin, Children: []*NavLink{{Id: "child"}}},
			},
		}

		treeRoot.RemoveEmptySectionsAndApplyNewInformationArchitecture(false)

		require.Equal(t, 2, len(treeRoot.Children))
	})

	t.Run("Should move admin section into cfg and rename when topnav is enabled", func(t *testing.T) {
		treeRoot := NavTreeRoot{
			Children: []*NavLink{
				{Id: NavIDCfg},
				{Id: NavIDAdmin, Children: []*NavLink{{Id: "child"}}},
			},
		}

		treeRoot.RemoveEmptySectionsAndApplyNewInformationArchitecture(true)

		require.Equal(t, "Administration", treeRoot.Children[0].Text)
		require.Equal(t, NavIDAdmin, treeRoot.Children[0].Children[0].Id)
	})

	t.Run("Should move reports into Dashboards", func(t *testing.T) {
		treeRoot := NavTreeRoot{
			Children: []*NavLink{
				{Id: NavIDDashboards},
				{Id: NavIDReporting},
			},
		}

		treeRoot.RemoveEmptySectionsAndApplyNewInformationArchitecture(true)

		require.Equal(t, NavIDReporting, treeRoot.Children[0].Children[0].Id)
	})
}
