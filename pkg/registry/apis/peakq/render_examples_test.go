package peakq

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apis/query/v0alpha1/template"
)

func TestRender(t *testing.T) {
	rT, err := template.RenderTemplate(basicTemplateSpec, map[string][]string{"metricName": {"up"}})
	require.NoError(t, err)
	require.Equal(t,
		basicTemplateRenderedTargets[0].Properties.GetString("expr"),
		rT[0].Properties.GetString("expr"))
	b, _ := json.MarshalIndent(basicTemplateSpec, "", " ")
	fmt.Println(string(b))
}
