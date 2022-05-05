package featuremgmt

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

func TestReadingFeatureSettings(t *testing.T) {
	config, err := readConfigFile("testdata/features.yaml")
	require.NoError(t, err, "No error when reading feature configs")

	assert.Equal(t, map[string]interface{}{
		"level": "free",
		"stack": "something",
		"valA":  "value from features.yaml",
	}, config.Vars)

	out, err := yaml.Marshal(config)
	require.NoError(t, err)
	fmt.Printf("%s", string(out))
}
