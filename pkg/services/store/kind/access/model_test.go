package access

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestFolderAccess(t *testing.T) {
	example := &FolderAccessRules{
		Rules: []FolderAccessRule{
			{Action: "read", Kind: "dashboard", Who: "*"},
			{Action: "admin", Kind: "*", Who: "ryan"},
		},
	}
	out, err := json.Marshal(example)
	require.NoError(t, err)

	summary, clean, err := GetObjectSummaryBuilder()(context.Background(), "test", out)
	require.NoError(t, err)
	require.Equal(t, models.StandardKindFolderAccess, summary.Kind)
	require.JSONEq(t, `{
		"rules": [
		  {
			"action": "admin",
			"kind": "*",
			"who": "ryan"
		  },
		  {
			"action": "read",
			"kind": "dashboard",
			"who": "*"
		  }
		]
	  }`, string(clean))
}
