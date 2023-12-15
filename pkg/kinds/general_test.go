package kinds

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apis"
)

func TestMetaAccessor(t *testing.T) {
	originInfo := &apis.ResourceOriginInfo{
		Name: "test",
		Path: "a/b/c",
		Key:  "kkk",
	}

	// Verify that you can set annotations when they do not exist
	dummy := &GrafanaResourceMetadata{}
	dummy.SetOriginInfo(originInfo)
	dummy.SetFolder("folderUID")

	require.Equal(t, map[string]string{
		"grafana.app/originName": "test",
		"grafana.app/originPath": "a/b/c",
		"grafana.app/originKey":  "kkk",
		"grafana.app/folder":     "folderUID",
	}, dummy.Annotations)
}
