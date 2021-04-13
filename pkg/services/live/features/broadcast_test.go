package features

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/models"

	"github.com/golang/mock/gomock"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
)

func TestNewBroadcastRunner(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()
	d := NewMockDispatcher(mockCtrl)
	br := NewBroadcastRunner(d)
	require.NotNil(t, br)
}

func TestBroadcastRunner_OnSubscribe(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()
	mockDispatcher := NewMockDispatcher(mockCtrl)

	channel := "stream/channel/test"
	data := json.RawMessage(`{}`)

	mockDispatcher.EXPECT().Dispatch(&models.GetLastLiveMessageQuery{
		Params: models.GetLastLiveMessageQueryParams{
			OrgId:   1,
			Channel: channel,
		},
	}).Do(func(query *models.GetLastLiveMessageQuery) error {
		query.Result = &models.LiveMessage{
			Data: data,
		}
		return nil
	}).Times(1)

	br := NewBroadcastRunner(mockDispatcher)
	require.NotNil(t, br)
	handler, err := br.GetHandlerForPath("test")
	require.NoError(t, err)
	reply, status, err := handler.OnSubscribe(
		context.Background(),
		&models.SignedInUser{OrgId: 1, UserId: 2},
		models.SubscribeEvent{Channel: channel, Path: "test"},
	)
	require.NoError(t, err)
	require.Equal(t, backend.SubscribeStreamStatusOK, status)
	require.Equal(t, data, reply.Data)
	require.True(t, reply.Presence)
	require.True(t, reply.JoinLeave)
	require.False(t, reply.Recover)
}

func TestBroadcastRunner_OnPublish(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()
	mockDispatcher := NewMockDispatcher(mockCtrl)

	channel := "stream/channel/test"
	data := json.RawMessage(`{}`)
	var orgID int64 = 1
	var userID int64 = 2

	mockDispatcher.EXPECT().Dispatch(&models.SaveLiveMessageQuery{
		Params: models.SaveLiveMessageQueryParams{
			OrgId:     orgID,
			CreatedBy: userID,
			Channel:   channel,
			Data:      data,
		},
	}).Do(func(query *models.SaveLiveMessageQuery) error {
		return nil
	}).Times(1)

	br := NewBroadcastRunner(mockDispatcher)
	require.NotNil(t, br)
	handler, err := br.GetHandlerForPath("test")
	require.NoError(t, err)
	reply, status, err := handler.OnPublish(
		context.Background(),
		&models.SignedInUser{OrgId: 1, UserId: 2},
		models.PublishEvent{Channel: channel, Path: "test", Data: data},
	)
	require.NoError(t, err)
	require.Equal(t, backend.PublishStreamStatusOK, status)
	require.Nil(t, reply.Data)
}
