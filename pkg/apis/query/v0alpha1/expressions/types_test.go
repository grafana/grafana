package expressions

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseQueriesIntoQueryDataRequest(t *testing.T) {
	defs := GetQueryTypeDefinitionList()
	out, err := json.MarshalIndent(defs, "", "  ")
	require.NoError(t, err)
	fmt.Printf("%s\n", out)
}
