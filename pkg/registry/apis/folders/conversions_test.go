package folders

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/services/folder"
)

func TestFolderConversions(t *testing.T) {
	input := &unstructured.Unstructured{}
	err := input.UnmarshalJSON([]byte(`{
      "kind": "Folder",
      "apiVersion": "folder.grafana.app/v0alpha1",
      "metadata": {
        "name": "be79sztagf20wd",
        "namespace": "default",
        "uid": "wfi3RARqQREzEKtUJCWurWevwbQ7i9ii0cA7JUIbMtEX",
        "resourceVersion": "1734509107000",
        "creationTimestamp": "2022-12-02T02:02:02Z",
				"generation": 4,
        "labels": {
          "grafana.app/deprecatedInternalID": "234"
        },
        "annotations": {
          "grafana.app/folder": "parent-folder-name",
          "grafana.app/updatedTimestamp": "2022-12-02T07:02:02Z",
          "grafana.app/repoName": "example-repo",
          "grafana.app/createdBy": "user:abc",
          "grafana.app/updatedBy": "service:xyz"
        }
      },
      "spec": {
        "title": "test folder",
        "description": "Something set in the file"
      }
    }`))
	require.NoError(t, err)

	created, err := time.Parse(time.RFC3339, "2022-12-02T02:02:02Z")
	created = created.UTC()
	require.NoError(t, err)

	converted, err := UnstructuredToLegacyFolder(input)
	require.NoError(t, err)
	require.Equal(t, folder.Folder{
		ID:          234,
		OrgID:       1,
		Version:     4,
		UID:         "be79sztagf20wd",
		ParentUID:   "parent-folder-name",
		Title:       "test folder",
		Description: "Something set in the file",
		URL:         "/dashboards/f/be79sztagf20wd/test-folder",
		Repository:  "example-repo",
		Created:     created,
		Updated:     created.Add(time.Hour * 5),
	}, *converted)
}
