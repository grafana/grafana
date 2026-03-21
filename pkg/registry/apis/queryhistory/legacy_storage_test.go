package queryhistory

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	queryhistorysvc "github.com/grafana/grafana/pkg/services/queryhistory"
)

func TestDTOToResource(t *testing.T) {
	queries, _ := simplejson.NewJson([]byte(`[{"refId":"A"}]`))
	dto := &queryhistorysvc.QueryHistoryDTO{
		UID:           "test-uid-123",
		DatasourceUID: "ds-abc",
		CreatedBy:     42,
		CreatedAt:     1700000000,
		Comment:       "my comment",
		Queries:       queries,
		Starred:       false,
	}

	resource, err := dtoToResource(dto, "default")
	require.NoError(t, err)
	require.NotNil(t, resource)
	assert.Equal(t, "test-uid-123", resource.Name)
	assert.Equal(t, "default", resource.Namespace)
	assert.Equal(t, "ds-abc", resource.Labels["grafana.app/datasource-uid"])
	assert.Equal(t, "ds-abc", resource.Spec.DatasourceUid)
	assert.Equal(t, "my comment", *resource.Spec.Comment)
	assert.NotNil(t, resource.Spec.Queries)
}
