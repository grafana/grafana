package webassets

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestReadWebassets(t *testing.T) {
	assets, err := readWebAssets("testdata/sample-assets-manifest.json")
	require.NoError(t, err)

	dto, err := json.MarshalIndent(assets, "", "  ")
	require.NoError(t, err)
	fmt.Printf("%s\n", string(dto))
}
