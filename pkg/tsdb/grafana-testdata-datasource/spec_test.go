package testdatasource

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	// "sigs.k8s.io/yaml" // uses the same structure as json!
)

func TestSpec(t *testing.T) {
	info, err := OpenAPIExtension()
	require.NoError(t, err)
	require.NotNil(t, info)

	jj, err := json.MarshalIndent(info, "", "  ")
	require.NoError(t, err)
	fmt.Printf("%s\n", string(jj))

	// jj, err = yaml.Marshal(info)
	// require.NoError(t, err)
	// fmt.Printf("%s\n", string(jj))
}
