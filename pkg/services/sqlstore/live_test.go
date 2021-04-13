// +build integration

package sqlstore

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestLiveMessage(t *testing.T) {
	ss := InitTestDB(t)

	getQuery := &models.GetLastLiveMessageQuery{
		Params: models.GetLastLiveMessageQueryParams{
			OrgId:   1,
			Channel: "test_channel",
		},
	}
	_, ok, err := ss.GetLastLiveMessage(getQuery)
	require.NoError(t, err)
	require.False(t, ok)

	saveQuery := &models.SaveLiveMessageQuery{
		Params: models.SaveLiveMessageQueryParams{
			OrgId:     1,
			Channel:   "test_channel",
			Data:      []byte(`{}`),
			CreatedBy: 2,
		},
	}
	err = ss.SaveLiveMessage(saveQuery)
	require.NoError(t, err)

	msg, ok, err := ss.GetLastLiveMessage(getQuery)
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, int64(1), msg.OrgId)
	require.Equal(t, "test_channel", msg.Channel)
	require.Equal(t, json.RawMessage(`{}`), msg.Data)
	require.Equal(t, int64(2), msg.CreatedBy)
	require.NotZero(t, msg.Created)

	// try saving again, should be replaced.
	saveQuery2 := &models.SaveLiveMessageQuery{
		Params: models.SaveLiveMessageQueryParams{
			OrgId:     1,
			Channel:   "test_channel",
			Data:      []byte(`{"input": "hello"}`),
			CreatedBy: 3,
		},
	}
	err = ss.SaveLiveMessage(saveQuery2)
	require.NoError(t, err)

	getQuery2 := &models.GetLastLiveMessageQuery{
		Params: models.GetLastLiveMessageQueryParams{
			OrgId:   1,
			Channel: "test_channel",
		},
	}
	msg2, ok, err := ss.GetLastLiveMessage(getQuery2)
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, int64(1), msg2.OrgId)
	require.Equal(t, "test_channel", msg2.Channel)
	require.Equal(t, json.RawMessage(`{"input": "hello"}`), msg2.Data)
	require.Equal(t, int64(3), msg2.CreatedBy)
	require.NotZero(t, msg2.Created)
}
