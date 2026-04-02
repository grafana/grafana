package app

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/live/pkg/apis/manifestdata"
)

func TestManifest(t *testing.T) {
	manifest := manifestdata.LocalManifest().ManifestData
	for _, k := range manifest.Kinds() {
		for _, v := range k.Versions {
			require.NotNil(t, v.Schema)
		}
	}
}
