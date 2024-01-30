package peakq

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRender(t *testing.T) {
	rT, err := Render(basicTemplateWithSelectedValue, map[string]string{"metricName": "up"})
	require.NoError(t, err)
	require.Equal(t, "up + up + 42", rT.Targets[0].Properties.Object["expr"])
	b, _ := json.MarshalIndent(basicTemplateWithSelectedValue, "", " ")
	fmt.Println(string(b))
}
