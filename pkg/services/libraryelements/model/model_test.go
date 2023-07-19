package model

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/kinds/librarypanel"
	"github.com/stretchr/testify/require"
)

func TestLibaryPanelConversion(t *testing.T) {
	body := `{}`

	src := LibraryElementDTO{
		Kind:      0, // always library panel
		FolderUID: "TheFolderUID",
		UID:       "TheUID",
		Version:   10,
		Model:     json.RawMessage(body),
		Meta: LibraryElementDTOMeta{
			Created: time.UnixMilli(946713600000).UTC(),  // 2000-01-01
			Updated: time.UnixMilli(1262332800000).UTC(), // 2010-01-01,
			CreatedBy: librarypanel.LibraryElementDTOMetaUser{
				Id: 11,
			},
			UpdatedBy: librarypanel.LibraryElementDTOMetaUser{
				Id: 12,
			},
		},
	}

	dst := src.ToResource()

	require.Equal(t, src.UID, dst.Metadata.Name)

	out, err := json.MarshalIndent(dst, "", "  ")
	require.NoError(t, err)
	fmt.Printf("%s", string(out))
	require.JSONEq(t, `{
		"apiVersion": "v0.0-alpha",
		"kind": "LibraryPanel",
		"metadata": {
		  "name": "TheUID",
		  "resourceVersion": "10",
		  "creationTimestamp": "2000-01-01T08:00:00Z",
		  "annotations": {
			"grafana.com/createdBy": "user:11",
			"grafana.com/folder": "TheFolderUID",
			"grafana.com/updatedBy": "user:12",
			"grafana.com/updatedTimestamp": "2010-01-01T08:00:00Z"
		  }
		},
		"spec": {}
	  }`, string(out))
}
