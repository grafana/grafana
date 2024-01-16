package kinds

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestMetaAccessor(t *testing.T) {
	originInfo := &ResourceOriginInfo{
		Name: "test",
		Path: "a/b/c",
		Key:  "kkk",
	}

	// Verify that you can set annotations when they do not exist
	dummy := &GrafanaResourceMetadata{}
	dummy.SetOriginInfo(originInfo)
	dummy.SetFolder("folderUID")

	// with any k8s object
	obj := &unstructured.Unstructured{}
	meta := MetaAccessor(obj)
	meta.SetOriginInfo(originInfo)
	meta.SetFolder("folderUID")

	require.Equal(t, map[string]string{
		"grafana.app/originName": "test",
		"grafana.app/originPath": "a/b/c",
		"grafana.app/originKey":  "kkk",
		"grafana.app/folder":     "folderUID",
	}, dummy.Annotations)
	require.Equal(t, dummy.Annotations, obj.GetAnnotations())
}
