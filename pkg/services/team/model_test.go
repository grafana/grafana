package team

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestTeamConversion(t *testing.T) {
	src := Team{
		ID:      123,
		UID:     "abc",
		Name:    "TeamA",
		Email:   "team@a.org",
		OrgID:   11,
		Created: time.UnixMilli(946713600000).UTC(),  // 2000-01-01
		Updated: time.UnixMilli(1262332800000).UTC(), // 2010-01-01
	}

	dst := src.ToResource()

	require.Equal(t, src.Name, dst.Spec.Name)

	out, err := json.MarshalIndent(dst, "", "  ")
	require.NoError(t, err)
	fmt.Printf("%s", string(out))
	require.JSONEq(t, `{
		"apiVersion": "v0.0-alpha",
		"kind": "Team",
		"metadata": {
		  "name": "abc",
		  "creationTimestamp": "2000-01-01T08:00:00Z",
		  "annotations": {
			"grafana.com/updatedTimestamp": "2010-01-01T08:00:00Z"
		  }
		},
		"spec": {
		  "email": "team@a.org",
		  "name": "TeamA"
		}
	  }`, string(out))
}
