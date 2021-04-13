// +build integration

package sqlstore

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestLiveMessage(t *testing.T) {
	InitTestDB(t)

	getQuery := &models.GetLastLiveMessageQuery{
		Params: models.GetLastLiveMessageQueryParams{
			OrgId:   1,
			Channel: "test_channel",
		},
	}
	err := GetLastLiveMessage(getQuery)
	require.NoError(t, err)
	require.Nil(t, getQuery.Result)

	saveQuery := &models.SaveLiveMessageQuery{
		Params: models.SaveLiveMessageQueryParams{
			OrgId:     1,
			Channel:   "test_channel",
			Data:      []byte(`{}`),
			CreatedBy: 2,
		},
	}
	err = SaveLiveMessage(saveQuery)
	require.NoError(t, err)

	err = GetLastLiveMessage(getQuery)
	require.NoError(t, err)
	require.NotNil(t, getQuery.Result)
	require.Equal(t, int64(1), getQuery.Result.OrgId)
	require.Equal(t, "test_channel", getQuery.Result.Channel)
	require.Equal(t, json.RawMessage(`{}`), getQuery.Result.Data)
	require.Equal(t, int64(2), getQuery.Result.CreatedBy)
	require.NotZero(t, getQuery.Result.Created)

	// try saving again, should be replaced.
	saveQuery2 := &models.SaveLiveMessageQuery{
		Params: models.SaveLiveMessageQueryParams{
			OrgId:     1,
			Channel:   "test_channel",
			Data:      []byte(`{"input": "hello"}`),
			CreatedBy: 3,
		},
	}
	err = SaveLiveMessage(saveQuery2)
	require.NoError(t, err)

	getQuery2 := &models.GetLastLiveMessageQuery{
		Params: models.GetLastLiveMessageQueryParams{
			OrgId:   1,
			Channel: "test_channel",
		},
	}
	err = GetLastLiveMessage(getQuery2)
	require.NoError(t, err)
	require.NotNil(t, getQuery2.Result)
	require.Equal(t, int64(1), getQuery2.Result.OrgId)
	require.Equal(t, "test_channel", getQuery2.Result.Channel)
	require.Equal(t, json.RawMessage(`{"input": "hello"}`), getQuery2.Result.Data)
	require.Equal(t, int64(3), getQuery2.Result.CreatedBy)
	require.NotZero(t, getQuery2.Result.Created)
}
