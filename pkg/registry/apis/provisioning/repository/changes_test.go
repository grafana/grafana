package repository

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

func TestChanges(t *testing.T) {
	t.Run("start the same", func(t *testing.T) {
		source, target := getBase(t)
		changes, err := Changes(source, target)
		require.NoError(t, err)
		require.Empty(t, changes)
	})

	t.Run("create a source file", func(t *testing.T) {
		source, target := getBase(t)
		source = append(source, FileTreeEntry{Path: "muta.json", Hash: "xyz", Blob: true})

		changes, err := Changes(source, target)
		require.NoError(t, err)
		require.Len(t, changes, 1)
		require.Equal(t, FileChange{
			Action: FileActionCreated,
			Path:   "muta.json",
			Ref:    "xyz",
		}, changes[0])
	})

	t.Run("delete a source file", func(t *testing.T) {
		source, target := getBase(t)
		source = []FileTreeEntry{source[0]}

		changes, err := Changes(source, target)
		require.NoError(t, err)
		require.Len(t, changes, 1)
		require.Equal(t, FileChange{
			Action: FileActionDeleted,
			Path:   "adsl62h.yaml",
			DB: &provisioning.ResourceListItem{
				Path:     "adsl62h.yaml",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
				Name:     "adsl62h-hrw-f-fvlt2dghp-gufrc4lisksgmq-c",
				Hash:     "ce5d497c4deadde6831162ce8509e2b2b1776237",
			},
		}, changes[0])
	})

	t.Run("modify a file", func(t *testing.T) {
		source, target := getBase(t)
		source[1].Hash = "different"

		changes, err := Changes(source, target)
		require.NoError(t, err)
		require.Len(t, changes, 1)
		require.Equal(t, FileChange{
			Action: FileActionUpdated,
			Path:   "adsl62h.yaml",
			DB: &provisioning.ResourceListItem{
				Path:     "adsl62h.yaml",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
				Name:     "adsl62h-hrw-f-fvlt2dghp-gufrc4lisksgmq-c",
				Hash:     "ce5d497c4deadde6831162ce8509e2b2b1776237",
			},
			Ref:         "different",
			PreviousRef: "ce5d497c4deadde6831162ce8509e2b2b1776237",
		}, changes[0])
	})
}

func getBase(t *testing.T) (source []FileTreeEntry, target *provisioning.ResourceList) {
	target = &provisioning.ResourceList{}
	err := json.Unmarshal([]byte(`{
		"kind": "ResourceList",
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"metadata": {},
		"items": [
			{
				"path": "",
				"group": "folder.grafana.app",
				"resource": "folders",
				"name": "simplelocal-3794ab9",
				"hash": ""
			},
			{
				"path": "ad4lwp2.yaml",
				"group": "dashboard.grafana.app",
				"resource": "dashboards",
				"name": "ad4lwp2-xofjsuo-mr5blr1zwimlfi0ds0pyrrpd",
				"hash": "ca83d64b9c4a23fed975aacdf47e7de8878b4ae0"
			},
			{
				"path": "adsl62h.yaml",
				"group": "dashboard.grafana.app",
				"resource": "dashboards",
				"name": "adsl62h-hrw-f-fvlt2dghp-gufrc4lisksgmq-c",
				"hash": "ce5d497c4deadde6831162ce8509e2b2b1776237"
			}
		]
	}`), target)
	require.NoError(t, err)

	source = []FileTreeEntry{
		{Path: "ad4lwp2.yaml", Hash: "ca83d64b9c4a23fed975aacdf47e7de8878b4ae0", Blob: true},
		{Path: "adsl62h.yaml", Hash: "ce5d497c4deadde6831162ce8509e2b2b1776237", Blob: true},
	}

	return // named values!
}
