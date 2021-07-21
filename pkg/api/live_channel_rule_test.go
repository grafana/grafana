package api

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/require"
)

func TestChannelRuleList(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()

	storageMock := NewMockChannelRuleStorage(mockCtrl)

	storageMock.EXPECT().ListChannelRules(context.Background(), models.ListLiveChannelRuleCommand{
		OrgId: testOrgID,
	}).DoAndReturn(func(ctx context.Context, _ models.ListLiveChannelRuleCommand) ([]*models.LiveChannelRule, error) {
		return []*models.LiveChannelRule{
			{
				Uid:     "1",
				OrgId:   testOrgID,
				Pattern: "x/y/*",
			},
			{
				Uid:     "2",
				OrgId:   testOrgID,
				Pattern: "x/z/*",
			},
		}, nil
	}).Times(1)

	api := channelRuleAPI{
		storage: storageMock,
	}

	sc := setupScenarioContext(t, "/api-channel-rules")
	sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
		sc.context = c
		sc.context.SignedInUser = &models.SignedInUser{OrgId: testOrgID, UserId: testUserID}
		return api.ListChannelRules(c)
	})

	sc.m.Get("/api/channel-rules", sc.defaultHandler)
	sc.fakeReq(http.MethodGet, "/api/channel-rules").exec()
	require.Equal(t, http.StatusOK, sc.resp.Code)
	var rules []*dtos.LiveChannelRuleListItem
	err := json.NewDecoder(sc.resp.Body).Decode(&rules)
	require.NoError(t, err)
	require.Len(t, rules, 2)
	require.Equal(t, "x/y/*", rules[0].Pattern)
}

func TestChannelRuleGet(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()

	storageMock := NewMockChannelRuleStorage(mockCtrl)

	storageMock.EXPECT().GetChannelRule(context.Background(), models.GetLiveChannelRuleCommand{
		Uid:   "1",
		OrgId: testOrgID,
	}).DoAndReturn(func(ctx context.Context, _ models.GetLiveChannelRuleCommand) (*models.LiveChannelRule, error) {
		return &models.LiveChannelRule{
			Uid:     "1",
			OrgId:   testOrgID,
			Pattern: "x/y/*",
		}, nil
	}).Times(1)

	api := channelRuleAPI{
		storage: storageMock,
	}

	sc := setupScenarioContext(t, "/api/channel-rules/1")
	sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
		sc.context = c
		sc.context.SignedInUser = &models.SignedInUser{OrgId: testOrgID, UserId: testUserID}
		return api.GetChannelRuleByUid(c)
	})

	sc.m.Get("/api/channel-rules/:uid", sc.defaultHandler)
	sc.fakeReq(http.MethodGet, sc.url).exec()
	require.Equal(t, http.StatusOK, sc.resp.Code)
	var rule *dtos.LiveChannelRule
	err := json.NewDecoder(sc.resp.Body).Decode(&rule)
	require.NoError(t, err)
	require.Equal(t, "x/y/*", rule.Pattern)
	require.Equal(t, "1", rule.Uid)
}

func TestChannelRuleCreate(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()

	storageMock := NewMockChannelRuleStorage(mockCtrl)

	testCmd := models.CreateLiveChannelRuleCommand{
		OrgId:   testOrgID,
		Pattern: "x/y/*",
		Settings: models.LiveChannelRuleSettings{
			RemoteWrite: &models.RemoteWriteConfig{
				Endpoint: "test",
			},
		},
		SecureSettings: map[string]string{
			"remoteWritePassword": "test",
		},
	}

	storageMock.EXPECT().CreateChannelRule(context.Background(), testCmd).DoAndReturn(func(ctx context.Context, _ models.CreateLiveChannelRuleCommand) (*models.LiveChannelRule, error) {
		return &models.LiveChannelRule{
			Uid:      "1",
			OrgId:    testCmd.OrgId,
			Pattern:  testCmd.Pattern,
			Settings: testCmd.Settings,
		}, nil
	}).Times(1)

	api := channelRuleAPI{
		storage: storageMock,
	}

	sc := setupScenarioContext(t, "/api/channel-rules")
	sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
		sc.context = c
		sc.context.SignedInUser = &models.SignedInUser{OrgId: testOrgID, UserId: testUserID}
		return api.CreateChannelRule(c, testCmd)
	})

	sc.m.Post("/api/channel-rules", sc.defaultHandler)
	sc.fakeReq(http.MethodPost, sc.url).exec()
	require.Equal(t, http.StatusOK, sc.resp.Code)
}

func TestChannelRuleUpdate(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()

	storageMock := NewMockChannelRuleStorage(mockCtrl)

	testCmd := models.UpdateLiveChannelRuleCommand{
		Uid:     "1",
		OrgId:   testOrgID,
		Pattern: "x/y/*",
		Settings: models.LiveChannelRuleSettings{
			RemoteWrite: &models.RemoteWriteConfig{
				Endpoint: "test",
			},
		},
		SecureSettings: map[string]string{
			"remoteWritePassword": "test",
		},
	}

	storageMock.EXPECT().UpdateChannelRule(context.Background(), testCmd).DoAndReturn(func(ctx context.Context, _ models.UpdateLiveChannelRuleCommand) (*models.LiveChannelRule, error) {
		return &models.LiveChannelRule{
			Uid:      "1",
			OrgId:    testCmd.OrgId,
			Pattern:  testCmd.Pattern,
			Settings: testCmd.Settings,
		}, nil
	}).Times(1)

	storageMock.EXPECT().GetChannelRule(context.Background(), models.GetLiveChannelRuleCommand{
		Uid:   "1",
		OrgId: testOrgID,
	}).DoAndReturn(func(ctx context.Context, _ models.GetLiveChannelRuleCommand) (*models.LiveChannelRule, error) {
		return &models.LiveChannelRule{
			Uid:     "1",
			OrgId:   testOrgID,
			Pattern: "x/y/*",
		}, nil
	}).Times(2)

	api := channelRuleAPI{
		storage: storageMock,
	}

	sc := setupScenarioContext(t, "/api/channel-rules/1")
	sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
		sc.context = c
		sc.context.SignedInUser = &models.SignedInUser{OrgId: testOrgID, UserId: testUserID}
		return api.UpdateChannelRule(c, testCmd)
	})

	sc.m.Put("/api/channel-rules/:uid", sc.defaultHandler)
	sc.fakeReq(http.MethodPut, sc.url).exec()
	require.Equal(t, http.StatusOK, sc.resp.Code)
}
