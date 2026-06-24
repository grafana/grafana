package app

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/live/pkg/apis/manifestdata"
)

func TestManifest(t *testing.T) {
	manifest := manifestdata.LocalManifest().ManifestData
	for _, v := range manifest.Versions {
		for _, k := range v.Kinds {
			require.NotNil(t, k.Schema)
		}
	}
}
