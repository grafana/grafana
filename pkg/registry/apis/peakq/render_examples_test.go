package peakq

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRender(t *testing.T) {
	rT, err := Render(basicTemplateSpec, map[string][]string{"metricName": {"up"}})
	require.NoError(t, err)
	require.Equal(t, basicTemplateRenderedTargets[0].Properties.Object["expr"], rT.Targets[0].Properties.Object["expr"])
	b, _ := json.MarshalIndent(basicTemplateSpec, "", " ")
	fmt.Println(string(b))
}
