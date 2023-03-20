package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardsDB "github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	. "github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/services/publicdashboards/database"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/publicdashboards/validation"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

var timeSettings = &TimeSettings{From: "now-12h", To: "now"}
var defaultPubdashTimeSettings = &TimeSettings{}
var dashboardData = simplejson.NewFromAny(map[string]interface{}{"time": map[string]interface{}{"from": "now-8h", "to": "now"}})
var SignedInUser = &user.SignedInUser{UserID: 1234, Login: "user@login.com"}

func TestLogPrefix(t *testing.T) {
	assert.Equal(t, LogPrefix, "publicdashboards.service")
}

func TestGetPublicDashboard(t *testing.T) {
	type storeResp struct {
		pd  *PublicDashboard
		d   *dashboards.Dashboard
		err error
	}

	testCases := []struct {
		Name        string
		AccessToken string
		StoreResp   *storeResp
		ErrResp     error
		DashResp    *dashboards.Dashboard
	}{
		{
			Name:        "returns a dashboard",
			AccessToken: "abc123",
			StoreResp: &storeResp{
				pd:  &PublicDashboard{AccessToken: "abcdToken", IsEnabled: true},
				d:   &dashboards.Dashboard{UID: "mydashboard", Data: dashboardData},
				err: nil,
			},
			ErrResp:  nil,
			DashResp: &dashboards.Dashboard{UID: "mydashboard", Data: dashboardData},
		},
		{
			Name:        "returns dashboard when isEnabled is false",
			AccessToken: "abc123",
			StoreResp: &storeResp{
				pd:  &PublicDashboard{AccessToken: "abcdToken", IsEnabled: false},
				d:   &dashboards.Dashboard{UID: "mydashboard", Data: dashboardData},
				err: nil,
			},
			ErrResp:  nil,
			DashResp: &dashboards.Dashboard{UID: "mydashboard", Data: dashboardData},
		},
		{
			Name:        "returns ErrPublicDashboardNotFound if PublicDashboard missing",
			AccessToken: "abc123",
			StoreResp:   &storeResp{pd: nil, d: nil, err: nil},
			ErrResp:     ErrPublicDashboardNotFound,
			DashResp:    nil,
		},
		{
			Name:        "returns ErrPublicDashboardNotFound if Dashboard missing",
			AccessToken: "abc123",
			StoreResp:   &storeResp{pd: nil, d: nil, err: nil},
			ErrResp:     ErrPublicDashboardNotFound,
			DashResp:    nil,
		},
	}

	for _, test := range testCases {
		t.Run(test.Name, func(t *testing.T) {
			fakeStore := FakePublicDashboardStore{}
			service := &PublicDashboardServiceImpl{
				log:   log.New("test.logger"),
				store: &fakeStore,
			}

			fakeStore.On("FindByAccessToken", mock.Anything, mock.Anything).Return(test.StoreResp.pd, test.StoreResp.err)
			fakeStore.On("FindDashboard", mock.Anything, mock.Anything, mock.Anything).Return(test.StoreResp.d, test.StoreResp.err)

			pdc, dash, err := service.FindPublicDashboardAndDashboardByAccessToken(context.Background(), test.AccessToken)
			if test.ErrResp != nil {
				assert.Error(t, test.ErrResp, err)
			} else {
				require.NoError(t, err)
			}

			assert.Equal(t, test.DashResp, dash)

			if test.DashResp != nil {
				assert.NotNil(t, dash.CreatedBy)
				assert.Equal(t, test.StoreResp.pd, pdc)
			}
		})
	}
}

func TestGetEnabledPublicDashboard(t *testing.T) {
	type storeResp struct {
		pd  *PublicDashboard
		d   *dashboards.Dashboard
		err error
	}

	testCases := []struct {
		Name        string
		AccessToken string
		StoreResp   *storeResp
		ErrResp     error
		DashResp    *dashboards.Dashboard
	}{
		{
			Name:        "returns a dashboard",
			AccessToken: "abc123",
			StoreResp: &storeResp{
				pd:  &PublicDashboard{AccessToken: "abcdToken", IsEnabled: true},
				d:   &dashboards.Dashboard{UID: "mydashboard", Data: dashboardData},
				err: nil,
			},
			ErrResp:  nil,
			DashResp: &dashboards.Dashboard{UID: "mydashboard", Data: dashboardData},
		},
		{
			Name:        "returns ErrPublicDashboardNotFound when isEnabled is false",
			AccessToken: "abc123",
			StoreResp: &storeResp{
				pd:  &PublicDashboard{AccessToken: "abcdToken", IsEnabled: false},
				d:   &dashboards.Dashboard{UID: "mydashboard"},
				err: nil,
			},
			ErrResp:  ErrPublicDashboardNotFound,
			DashResp: nil,
		},
	}

	for _, test := range testCases {
		t.Run(test.Name, func(t *testing.T) {
			fakeStore := FakePublicDashboardStore{}
			service := &PublicDashboardServiceImpl{
				log:   log.New("test.logger"),
				store: &fakeStore,
			}

			fakeStore.On("FindByAccessToken", mock.Anything, mock.Anything).Return(test.StoreResp.pd, test.StoreResp.err)
			fakeStore.On("FindDashboard", mock.Anything, mock.Anything, mock.Anything).Return(test.StoreResp.d, test.StoreResp.err)

			pdc, dash, err := service.FindEnabledPublicDashboardAndDashboardByAccessToken(context.Background(), test.AccessToken)
			if test.ErrResp != nil {
				assert.Error(t, test.ErrResp, err)
			} else {
				require.NoError(t, err)
			}

			assert.Equal(t, test.DashResp, dash)

			if test.DashResp != nil {
				assert.NotNil(t, dash.CreatedBy)
				assert.Equal(t, test.StoreResp.pd, pdc)
			}
		})
	}
}

// We're using sqlite here because testing all of the behaviors with mocks in
// the correct order is convoluted.
func TestCreatePublicDashboard(t *testing.T) {
	t.Run("Create public dashboard", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		quotaService := quotatest.New(false, nil)
		dashboardStore, err := dashboardsDB.ProvideDashboardStore(sqlStore, sqlStore.Cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotaService)
		require.NoError(t, err)
		publicdashboardStore := database.ProvideStore(sqlStore)
		dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true, []map[string]interface{}{}, nil)
		serviceWrapper := ProvideServiceWrapper(publicdashboardStore)

		service := &PublicDashboardServiceImpl{
			log:            log.New("test.logger"),
			store:          publicdashboardStore,
			serviceWrapper: serviceWrapper,
		}

		dto := &SavePublicDashboardDTO{
			DashboardUid: dashboard.UID,
			OrgId:        dashboard.OrgID,
			UserId:       7,
			PublicDashboard: &PublicDashboard{
				IsEnabled:            true,
				AnnotationsEnabled:   false,
				TimeSelectionEnabled: true,
				Share:                EmailShareType,
				DashboardUid:         "NOTTHESAME",
				OrgId:                9999999,
				TimeSettings:         timeSettings,
			},
		}

		_, err = service.Create(context.Background(), SignedInUser, dto)
		require.NoError(t, err)

		pubdash, err := service.FindByDashboardUid(context.Background(), dashboard.OrgID, dashboard.UID)
		require.NoError(t, err)

		// DashboardUid/OrgId/CreatedBy set by the command, not parameters
		assert.Equal(t, dashboard.UID, pubdash.DashboardUid)
		assert.Equal(t, dashboard.OrgID, pubdash.OrgId)
		assert.Equal(t, dto.UserId, pubdash.CreatedBy)
		assert.Equal(t, dto.PublicDashboard.AnnotationsEnabled, pubdash.AnnotationsEnabled)
		assert.Equal(t, dto.PublicDashboard.TimeSelectionEnabled, pubdash.TimeSelectionEnabled)
		// ExistsEnabledByDashboardUid set by parameters
		assert.Equal(t, dto.PublicDashboard.IsEnabled, pubdash.IsEnabled)
		// CreatedAt set to non-zero time
		assert.NotEqual(t, &time.Time{}, pubdash.CreatedAt)
		// Time settings set by db
		assert.Equal(t, timeSettings, pubdash.TimeSettings)
		assert.Equal(t, dto.PublicDashboard.Share, pubdash.Share)
		// accessToken is valid uuid
		_, err = uuid.Parse(pubdash.AccessToken)
		require.NoError(t, err, "expected a valid UUID, got %s", pubdash.AccessToken)
	})

	t.Run("Validate pubdash has default time setting value", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		quotaService := quotatest.New(false, nil)
		dashboardStore, err := dashboardsDB.ProvideDashboardStore(sqlStore, sqlStore.Cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotaService)
		require.NoError(t, err)
		publicdashboardStore := database.ProvideStore(sqlStore)
		dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true, []map[string]interface{}{}, nil)
		serviceWrapper := ProvideServiceWrapper(publicdashboardStore)

		service := &PublicDashboardServiceImpl{
			log:            log.New("test.logger"),
			store:          publicdashboardStore,
			serviceWrapper: serviceWrapper,
		}

		dto := &SavePublicDashboardDTO{
			DashboardUid: dashboard.UID,
			OrgId:        dashboard.OrgID,
			UserId:       7,
			PublicDashboard: &PublicDashboard{
				IsEnabled:    true,
				DashboardUid: "NOTTHESAME",
				OrgId:        9999999,
			},
		}

		_, err = service.Create(context.Background(), SignedInUser, dto)
		require.NoError(t, err)

		pubdash, err := service.FindByDashboardUid(context.Background(), dashboard.OrgID, dashboard.UID)
		require.NoError(t, err)
		assert.Equal(t, defaultPubdashTimeSettings, pubdash.TimeSettings)
	})

	t.Run("Creates pubdash whose dashboard has template variables successfully", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		quotaService := quotatest.New(false, nil)
		dashboardStore, err := dashboardsDB.ProvideDashboardStore(sqlStore, sqlStore.Cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotaService)
		require.NoError(t, err)
		publicdashboardStore := database.ProvideStore(sqlStore)
		templateVars := make([]map[string]interface{}, 1)
		dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true, templateVars, nil)
		serviceWrapper := ProvideServiceWrapper(publicdashboardStore)

		service := &PublicDashboardServiceImpl{
			log:            log.New("test.logger"),
			store:          publicdashboardStore,
			serviceWrapper: serviceWrapper,
		}

		dto := &SavePublicDashboardDTO{
			DashboardUid: dashboard.UID,
			OrgId:        dashboard.OrgID,
			UserId:       7,
			PublicDashboard: &PublicDashboard{
				IsEnabled:    true,
				DashboardUid: "NOTTHESAME",
				OrgId:        9999999,
			},
		}

		_, err = service.Create(context.Background(), SignedInUser, dto)
		require.NoError(t, err)

		pubdash, err := service.FindByDashboardUid(context.Background(), dashboard.OrgID, dashboard.UID)
		require.NoError(t, err)

		assert.Equal(t, dashboard.UID, pubdash.DashboardUid)
		assert.Equal(t, dashboard.OrgID, pubdash.OrgId)
	})

	t.Run("Throws an error when pubdash with generated access token already exists", func(t *testing.T) {
		dashboard := dashboards.NewDashboard("testDashie")
		pubdash := &PublicDashboard{
			IsEnabled:          true,
			AnnotationsEnabled: false,
			DashboardUid:       "NOTTHESAME",
			OrgId:              9999999,
			TimeSettings:       timeSettings,
		}

		publicDashboardStore := &FakePublicDashboardStore{}
		publicDashboardStore.On("FindDashboard", mock.Anything, mock.Anything, mock.Anything).Return(dashboard, nil)
		publicDashboardStore.On("Find", mock.Anything, mock.Anything).Return(nil, nil)
		publicDashboardStore.On("FindByAccessToken", mock.Anything, mock.Anything).Return(pubdash, nil)

		service := &PublicDashboardServiceImpl{
			log:   log.New("test.logger"),
			store: publicDashboardStore,
		}

		dto := &SavePublicDashboardDTO{
			DashboardUid: "an-id",
			OrgId:        8,
			UserId:       7,
			PublicDashboard: &PublicDashboard{
				IsEnabled:    true,
				DashboardUid: "NOTTHESAME",
				OrgId:        9999999,
			},
		}

		_, err := service.Create(context.Background(), SignedInUser, dto)
		require.Error(t, err)
		require.Equal(t, err, ErrInternalServerError.Errorf("failed to generate a unique accesssToken for public dashboard"))
		publicDashboardStore.AssertNotCalled(t, "Create")
	})

	t.Run("Returns error if public dashboard exists", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		dashboardStore, err := dashboardsDB.ProvideDashboardStore(sqlStore, sqlStore.Cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotatest.New(false, nil))
		require.NoError(t, err)
		publicdashboardStore := database.ProvideStore(sqlStore)
		dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true, []map[string]interface{}{}, nil)

		service := &PublicDashboardServiceImpl{
			log:   log.New("test.logger"),
			store: publicdashboardStore,
		}

		dto := &SavePublicDashboardDTO{
			DashboardUid: dashboard.UID,
			OrgId:        dashboard.OrgID,
			UserId:       7,
			PublicDashboard: &PublicDashboard{
				AnnotationsEnabled: false,
				IsEnabled:          true,
				TimeSettings:       timeSettings,
			},
		}

		savedPubdash, err := service.Create(context.Background(), SignedInUser, dto)
		require.NoError(t, err)

		// attempt to overwrite settings
		dto = &SavePublicDashboardDTO{
			DashboardUid: dashboard.UID,
			OrgId:        dashboard.OrgID,
			UserId:       8,
			PublicDashboard: &PublicDashboard{
				Uid:          savedPubdash.Uid,
				OrgId:        9,
				DashboardUid: "abc1234",
				CreatedBy:    9,
				CreatedAt:    time.Time{},

				IsEnabled:          true,
				AnnotationsEnabled: true,
				TimeSettings:       timeSettings,
				AccessToken:        "NOTAREALUUID",
			},
		}

		_, err = service.Create(context.Background(), SignedInUser, dto)
		require.Error(t, err)
		assert.True(t, ErrBadRequest.Is(err))
	})

	t.Run("Validate pubdash has default share value", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		quotaService := quotatest.New(false, nil)
		dashboardStore, err := dashboardsDB.ProvideDashboardStore(sqlStore, sqlStore.Cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotaService)
		require.NoError(t, err)
		publicdashboardStore := database.ProvideStore(sqlStore)
		dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true, []map[string]interface{}{}, nil)
		serviceWrapper := ProvideServiceWrapper(publicdashboardStore)

		service := &PublicDashboardServiceImpl{
			log:            log.New("test.logger"),
			store:          publicdashboardStore,
			serviceWrapper: serviceWrapper,
		}

		dto := &SavePublicDashboardDTO{
			DashboardUid: dashboard.UID,
			OrgId:        dashboard.OrgID,
			UserId:       7,
			PublicDashboard: &PublicDashboard{
				IsEnabled:    true,
				DashboardUid: "NOTTHESAME",
				OrgId:        9999999,
			},
		}

		_, err = service.Create(context.Background(), SignedInUser, dto)
		require.NoError(t, err)

		pubdash, err := service.FindByDashboardUid(context.Background(), dashboard.OrgID, dashboard.UID)
		require.NoError(t, err)
		// if share type is empty should be populated with public by default
		assert.Equal(t, PublicShareType, pubdash.Share)
	})
}

func TestUpdatePublicDashboard(t *testing.T) {
	t.Run("Updating public dashboard", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		quotaService := quotatest.New(false, nil)
		dashboardStore, err := dashboardsDB.ProvideDashboardStore(sqlStore, sqlStore.Cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotaService)
		require.NoError(t, err)
		publicdashboardStore := database.ProvideStore(sqlStore)
		dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true, []map[string]interface{}{}, nil)

		service := &PublicDashboardServiceImpl{
			log:   log.New("test.logger"),
			store: publicdashboardStore,
		}

		dto := &SavePublicDashboardDTO{
			DashboardUid: dashboard.UID,
			OrgId:        dashboard.OrgID,
			UserId:       7,
			PublicDashboard: &PublicDashboard{
				AnnotationsEnabled:   false,
				IsEnabled:            true,
				TimeSelectionEnabled: false,
				TimeSettings:         timeSettings,
			},
		}

		// insert initial pubdash
		savedPubdash, err := service.Create(context.Background(), SignedInUser, dto)
		require.NoError(t, err)

		// attempt to overwrite settings
		dto = &SavePublicDashboardDTO{
			DashboardUid: dashboard.UID,
			OrgId:        dashboard.OrgID,
			UserId:       8,
			PublicDashboard: &PublicDashboard{
				Uid:          savedPubdash.Uid,
				OrgId:        9,
				DashboardUid: "abc1234",
				CreatedBy:    9,
				CreatedAt:    time.Time{},

				IsEnabled:            true,
				AnnotationsEnabled:   true,
				TimeSelectionEnabled: true,
				TimeSettings:         timeSettings,
				AccessToken:          "NOTAREALUUID",
			},
		}
		updatedPubdash, err := service.Update(context.Background(), SignedInUser, dto)
		require.NoError(t, err)

		// don't get updated
		assert.Equal(t, savedPubdash.DashboardUid, updatedPubdash.DashboardUid)
		assert.Equal(t, savedPubdash.OrgId, updatedPubdash.OrgId)
		assert.Equal(t, savedPubdash.CreatedAt, updatedPubdash.CreatedAt)
		assert.Equal(t, savedPubdash.CreatedBy, updatedPubdash.CreatedBy)
		assert.Equal(t, savedPubdash.AccessToken, updatedPubdash.AccessToken)

		// gets updated
		assert.Equal(t, dto.PublicDashboard.IsEnabled, updatedPubdash.IsEnabled)
		assert.Equal(t, dto.PublicDashboard.AnnotationsEnabled, updatedPubdash.AnnotationsEnabled)
		assert.Equal(t, dto.PublicDashboard.TimeSelectionEnabled, updatedPubdash.TimeSelectionEnabled)
		assert.Equal(t, dto.PublicDashboard.TimeSettings, updatedPubdash.TimeSettings)
		assert.Equal(t, dto.UserId, updatedPubdash.UpdatedBy)
		assert.NotEqual(t, &time.Time{}, updatedPubdash.UpdatedAt)
	})

	t.Run("Updating set empty time settings", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		quotaService := quotatest.New(false, nil)
		dashboardStore, err := dashboardsDB.ProvideDashboardStore(sqlStore, sqlStore.Cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotaService)
		require.NoError(t, err)
		publicdashboardStore := database.ProvideStore(sqlStore)
		dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true, []map[string]interface{}{}, nil)

		service := &PublicDashboardServiceImpl{
			log:   log.New("test.logger"),
			store: publicdashboardStore,
		}

		dto := &SavePublicDashboardDTO{
			DashboardUid: dashboard.UID,
			OrgId:        dashboard.OrgID,
			UserId:       7,
			PublicDashboard: &PublicDashboard{
				IsEnabled:    true,
				TimeSettings: timeSettings,
			},
		}

		savedPubdash, err := service.Create(context.Background(), SignedInUser, dto)
		require.NoError(t, err)

		// attempt to overwrite settings
		dto = &SavePublicDashboardDTO{
			DashboardUid: dashboard.UID,
			OrgId:        dashboard.OrgID,
			UserId:       8,
			PublicDashboard: &PublicDashboard{
				Uid:          savedPubdash.Uid,
				OrgId:        9,
				DashboardUid: "abc1234",
				CreatedBy:    9,
				CreatedAt:    time.Time{},

				IsEnabled:   true,
				AccessToken: "NOTAREALUUID",
			},
		}

		updatedPubdash, err := service.Update(context.Background(), SignedInUser, dto)
		require.NoError(t, err)

		assert.Equal(t, &TimeSettings{}, updatedPubdash.TimeSettings)
	})
}

func TestDeletePublicDashboard(t *testing.T) {
	testCases := []struct {
		Name             string
		AffectedRowsResp int64
		ExpectedErrResp  error
		StoreRespErr     error
	}{
		{
			Name:             "Successfully deletes a public dashboards",
			AffectedRowsResp: 1,
			ExpectedErrResp:  nil,
			StoreRespErr:     nil,
		},
		{
			Name:             "Public dashboard not found",
			AffectedRowsResp: 0,
			ExpectedErrResp:  nil,
			StoreRespErr:     nil,
		},
		{
			Name:             "Database error",
			AffectedRowsResp: 0,
			ExpectedErrResp:  ErrInternalServerError.Errorf("Delete: failed to delete a public dashboard by Uid: uid db error!"),
			StoreRespErr:     errors.New("db error!"),
		},
	}

	for _, tt := range testCases {
		t.Run(tt.Name, func(t *testing.T) {
			store := NewFakePublicDashboardStore(t)
			store.On("Delete", mock.Anything, mock.Anything).Return(tt.AffectedRowsResp, tt.StoreRespErr)
			serviceWrapper := &PublicDashboardServiceWrapperImpl{
				log:   log.New("test.logger"),
				store: store,
			}
			service := &PublicDashboardServiceImpl{
				log:            log.New("test.logger"),
				store:          store,
				serviceWrapper: serviceWrapper,
			}

			err := service.Delete(context.Background(), "uid")
			if tt.ExpectedErrResp != nil {
				assert.Equal(t, tt.ExpectedErrResp.Error(), err.Error())
				assert.Equal(t, tt.ExpectedErrResp.Error(), err.Error())
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestPublicDashboardServiceImpl_getSafeIntervalAndMaxDataPoints(t *testing.T) {
	type args struct {
		reqDTO PublicDashboardQueryDTO
		ts     TimeSettings
	}
	tests := []struct {
		name                  string
		args                  args
		wantSafeInterval      int64
		wantSafeMaxDataPoints int64
	}{
		{
			name: "return original interval",
			args: args{
				reqDTO: PublicDashboardQueryDTO{
					IntervalMs:    10000,
					MaxDataPoints: 300,
				},
				ts: TimeSettings{
					From: "now-3h",
					To:   "now",
				},
			},
			wantSafeInterval:      10000,
			wantSafeMaxDataPoints: 300,
		},
		{
			name: "return safe interval because of a small interval",
			args: args{
				reqDTO: PublicDashboardQueryDTO{
					IntervalMs:    1000,
					MaxDataPoints: 300,
				},
				ts: TimeSettings{
					From: "now-6h",
					To:   "now",
				},
			},
			wantSafeInterval:      2000,
			wantSafeMaxDataPoints: 11000,
		},
		{
			name: "return safe interval for long time range",
			args: args{
				reqDTO: PublicDashboardQueryDTO{
					IntervalMs:    100,
					MaxDataPoints: 300,
				},
				ts: TimeSettings{
					From: "now-90d",
					To:   "now",
				},
			},
			wantSafeInterval:      600000,
			wantSafeMaxDataPoints: 11000,
		},
		{
			name: "return safe interval when reqDTO is empty",
			args: args{
				reqDTO: PublicDashboardQueryDTO{},
				ts: TimeSettings{
					From: "now-90d",
					To:   "now",
				},
			},
			wantSafeInterval:      600000,
			wantSafeMaxDataPoints: 11000,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pd := &PublicDashboardServiceImpl{
				intervalCalculator: intervalv2.NewCalculator(),
			}
			got, got1 := pd.getSafeIntervalAndMaxDataPoints(tt.args.reqDTO, tt.args.ts)
			assert.Equalf(t, tt.wantSafeInterval, got, "getSafeIntervalAndMaxDataPoints(%v, %v)", tt.args.reqDTO, tt.args.ts)
			assert.Equalf(t, tt.wantSafeMaxDataPoints, got1, "getSafeIntervalAndMaxDataPoints(%v, %v)", tt.args.reqDTO, tt.args.ts)
		})
	}
}

func TestDashboardEnabledChanged(t *testing.T) {
	t.Run("created isEnabled: false", func(t *testing.T) {
		assert.False(t, publicDashboardIsEnabledChanged(nil, &PublicDashboard{IsEnabled: false}))
	})

	t.Run("created isEnabled: true", func(t *testing.T) {
		assert.True(t, publicDashboardIsEnabledChanged(nil, &PublicDashboard{IsEnabled: true}))
	})

	t.Run("updated isEnabled same", func(t *testing.T) {
		assert.False(t, publicDashboardIsEnabledChanged(&PublicDashboard{IsEnabled: true}, &PublicDashboard{IsEnabled: true}))
	})

	t.Run("updated isEnabled changed", func(t *testing.T) {
		assert.True(t, publicDashboardIsEnabledChanged(&PublicDashboard{IsEnabled: false}, &PublicDashboard{IsEnabled: true}))
	})
}

func TestPublicDashboardServiceImpl_ListPublicDashboards(t *testing.T) {
	type args struct {
		ctx   context.Context
		u     *user.SignedInUser
		orgId int64
	}

	testCases := []struct {
		name         string
		args         args
		evaluateFunc func(c context.Context, u *user.SignedInUser, e accesscontrol.Evaluator) (bool, error)
		want         []PublicDashboardListResponse
		wantErr      assert.ErrorAssertionFunc
	}{
		{
			name: "should return empty list when user does not have permissions to read any dashboard",
			args: args{
				ctx:   context.Background(),
				u:     &user.SignedInUser{OrgID: 1},
				orgId: 1,
			},
			want:    []PublicDashboardListResponse{},
			wantErr: assert.NoError,
		},
		{
			name: "should return all dashboards when has permissions",
			args: args{
				ctx: context.Background(),
				u: &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
					1: {"dashboards:read": {
						"dashboards:uid:0S6TmO67z", "dashboards:uid:1S6TmO67z", "dashboards:uid:2S6TmO67z", "dashboards:uid:9S6TmO67z",
					}}},
				},
				orgId: 1,
			},
			want: []PublicDashboardListResponse{
				{
					Uid:          "0GwW7mgVk",
					AccessToken:  "0b458cb7fe7f42c68712078bcacee6e3",
					DashboardUid: "0S6TmO67z",
					Title:        "my zero dashboard",
					IsEnabled:    true,
				},
				{
					Uid:          "1GwW7mgVk",
					AccessToken:  "1b458cb7fe7f42c68712078bcacee6e3",
					DashboardUid: "1S6TmO67z",
					Title:        "my first dashboard",
					IsEnabled:    true,
				},
				{
					Uid:          "2GwW7mgVk",
					AccessToken:  "2b458cb7fe7f42c68712078bcacee6e3",
					DashboardUid: "2S6TmO67z",
					Title:        "my second dashboard",
					IsEnabled:    false,
				},
				{
					Uid:          "9GwW7mgVk",
					AccessToken:  "deletedashboardaccesstoken",
					DashboardUid: "9S6TmO67z",
					Title:        "",
					IsEnabled:    true,
				},
			},
			wantErr: assert.NoError,
		},
		{
			name: "should return only dashboards with permissions",
			args: args{
				ctx: context.Background(),
				u: &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
					1: {"dashboards:read": {"dashboards:uid:0S6TmO67z"}}},
				},
				orgId: 1,
			},
			want: []PublicDashboardListResponse{
				{
					Uid:          "0GwW7mgVk",
					AccessToken:  "0b458cb7fe7f42c68712078bcacee6e3",
					DashboardUid: "0S6TmO67z",
					Title:        "my zero dashboard",
					IsEnabled:    true,
				},
			},
			wantErr: assert.NoError,
		},
		{
			name: "should return orphaned public dashboards",
			args: args{
				ctx: context.Background(),
				u: &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
					1: {"dashboards:read": {"dashboards:uid:0S6TmO67z"}}},
				},
				orgId: 1,
			},
			evaluateFunc: func(c context.Context, u *user.SignedInUser, e accesscontrol.Evaluator) (bool, error) {
				return false, dashboards.ErrDashboardNotFound
			},
			want: []PublicDashboardListResponse{
				{
					Uid:          "0GwW7mgVk",
					AccessToken:  "0b458cb7fe7f42c68712078bcacee6e3",
					DashboardUid: "0S6TmO67z",
					Title:        "my zero dashboard",
					IsEnabled:    true,
				},
				{
					Uid:          "1GwW7mgVk",
					AccessToken:  "1b458cb7fe7f42c68712078bcacee6e3",
					DashboardUid: "1S6TmO67z",
					Title:        "my first dashboard",
					IsEnabled:    true,
				},
				{
					Uid:          "2GwW7mgVk",
					AccessToken:  "2b458cb7fe7f42c68712078bcacee6e3",
					DashboardUid: "2S6TmO67z",
					Title:        "my second dashboard",
					IsEnabled:    false,
				},
				{
					Uid:          "9GwW7mgVk",
					AccessToken:  "deletedashboardaccesstoken",
					DashboardUid: "9S6TmO67z",
					Title:        "",
					IsEnabled:    true,
				},
			},
			wantErr: assert.NoError,
		},
		{
			name: "errors different than not data found should be returned",
			args: args{
				ctx: context.Background(),
				u: &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
					1: {"dashboards:read": {"dashboards:uid:0S6TmO67z"}}},
				},
				orgId: 1,
			},
			evaluateFunc: func(c context.Context, u *user.SignedInUser, e accesscontrol.Evaluator) (bool, error) {
				return false, dashboards.ErrDashboardCorrupt
			},
			want:    nil,
			wantErr: assert.Error,
		},
	}

	mockedDashboards := []PublicDashboardListResponse{
		{
			Uid:          "0GwW7mgVk",
			AccessToken:  "0b458cb7fe7f42c68712078bcacee6e3",
			DashboardUid: "0S6TmO67z",
			Title:        "my zero dashboard",
			IsEnabled:    true,
		},
		{
			Uid:          "1GwW7mgVk",
			AccessToken:  "1b458cb7fe7f42c68712078bcacee6e3",
			DashboardUid: "1S6TmO67z",
			Title:        "my first dashboard",
			IsEnabled:    true,
		},
		{
			Uid:          "2GwW7mgVk",
			AccessToken:  "2b458cb7fe7f42c68712078bcacee6e3",
			DashboardUid: "2S6TmO67z",
			Title:        "my second dashboard",
			IsEnabled:    false,
		},
		{
			Uid:          "9GwW7mgVk",
			AccessToken:  "deletedashboardaccesstoken",
			DashboardUid: "9S6TmO67z",
			Title:        "",
			IsEnabled:    true,
		},
	}

	store := NewFakePublicDashboardStore(t)
	store.On("FindAll", mock.Anything, mock.Anything).
		Return(mockedDashboards, nil)

	ac := tests.SetupMockAccesscontrol(t,
		func(c context.Context, siu *user.SignedInUser, _ accesscontrol.Options) ([]accesscontrol.Permission, error) {
			return []accesscontrol.Permission{}, nil
		},
		false,
	)

	pd := &PublicDashboardServiceImpl{
		log:   log.New("test.logger"),
		store: store,
		ac:    ac,
	}

	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			ac.EvaluateFunc = tt.evaluateFunc

			got, err := pd.FindAll(tt.args.ctx, tt.args.u, tt.args.orgId)
			if !tt.wantErr(t, err, fmt.Sprintf("FindAll(%v, %v, %v)", tt.args.ctx, tt.args.u, tt.args.orgId)) {
				return
			}
			assert.Equalf(t, tt.want, got, "FindAll(%v, %v, %v)", tt.args.ctx, tt.args.u, tt.args.orgId)
		})
	}
}

func TestPublicDashboardServiceImpl_NewPublicDashboardUid(t *testing.T) {
	mockedDashboard := &PublicDashboard{
		IsEnabled:          true,
		AnnotationsEnabled: false,
		DashboardUid:       "NOTTHESAME",
		OrgId:              9999999,
		TimeSettings:       timeSettings,
	}

	type args struct {
		ctx context.Context
	}

	type mockResponse struct {
		PublicDashboard *PublicDashboard
		Err             error
	}
	tests := []struct {
		name      string
		args      args
		mockStore *mockResponse
		want      string
		wantErr   assert.ErrorAssertionFunc
	}{
		{
			name:      "should return a new uid",
			args:      args{ctx: context.Background()},
			mockStore: &mockResponse{nil, nil},
			want:      "NOTTHESAME",
			wantErr:   assert.NoError,
		},
		{
			name:      "should return an error if the generated uid exists 3 times",
			args:      args{ctx: context.Background()},
			mockStore: &mockResponse{mockedDashboard, nil},
			want:      "",
			wantErr:   assert.Error,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := NewFakePublicDashboardStore(t)
			store.On("Find", mock.Anything, mock.Anything).
				Return(tt.mockStore.PublicDashboard, tt.mockStore.Err)

			pd := &PublicDashboardServiceImpl{store: store}

			got, err := pd.NewPublicDashboardUid(tt.args.ctx)
			if !tt.wantErr(t, err, fmt.Sprintf("NewPublicDashboardUid(%v)", tt.args.ctx)) {
				return
			}

			if err == nil {
				assert.NotEqual(t, got, tt.want, "NewPublicDashboardUid(%v)", tt.args.ctx)
				assert.True(t, util.IsValidShortUID(got), "NewPublicDashboardUid(%v)", tt.args.ctx)
				store.AssertNumberOfCalls(t, "Find", 1)
			} else {
				store.AssertNumberOfCalls(t, "Find", 3)
				assert.True(t, ErrInternalServerError.Is(err))
			}
		})
	}
}

func TestPublicDashboardServiceImpl_NewPublicDashboardAccessToken(t *testing.T) {
	mockedDashboard := &PublicDashboard{
		IsEnabled:          true,
		AnnotationsEnabled: false,
		DashboardUid:       "NOTTHESAME",
		OrgId:              9999999,
		TimeSettings:       timeSettings,
	}

	type args struct {
		ctx context.Context
	}

	type mockResponse struct {
		PublicDashboard *PublicDashboard
		Err             error
	}
	tests := []struct {
		name      string
		args      args
		mockStore *mockResponse
		want      string
		wantErr   assert.ErrorAssertionFunc
	}{
		{
			name:      "should return a new access token",
			args:      args{ctx: context.Background()},
			mockStore: &mockResponse{nil, nil},
			want:      "6522e152530f4ee76522e152530f4ee7",
			wantErr:   assert.NoError,
		},
		{
			name:      "should return an error if the generated access token exists 3 times",
			args:      args{ctx: context.Background()},
			mockStore: &mockResponse{mockedDashboard, nil},
			want:      "",
			wantErr:   assert.Error,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := NewFakePublicDashboardStore(t)
			store.On("FindByAccessToken", mock.Anything, mock.Anything).
				Return(tt.mockStore.PublicDashboard, tt.mockStore.Err)

			pd := &PublicDashboardServiceImpl{store: store}

			got, err := pd.NewPublicDashboardAccessToken(tt.args.ctx)
			if !tt.wantErr(t, err, fmt.Sprintf("NewPublicDashboardAccessToken(%v)", tt.args.ctx)) {
				return
			}

			if err == nil {
				assert.NotEqual(t, got, tt.want, "NewPublicDashboardAccessToken(%v)", tt.args.ctx)
				assert.True(t, validation.IsValidAccessToken(got), "NewPublicDashboardAccessToken(%v)", tt.args.ctx)
				store.AssertNumberOfCalls(t, "FindByAccessToken", 1)
			} else {
				store.AssertNumberOfCalls(t, "FindByAccessToken", 3)
				assert.True(t, ErrInternalServerError.Is(err))
			}
		})
	}
}

func TestDeleteByDashboard(t *testing.T) {
	t.Run("will return nil when pubdash not found", func(t *testing.T) {
		store := NewFakePublicDashboardStore(t)
		pd := &PublicDashboardServiceImpl{store: store, serviceWrapper: ProvideServiceWrapper(store)}
		dashboard := &dashboards.Dashboard{UID: "1", OrgID: 1, IsFolder: false}
		store.On("FindByDashboardUid", mock.Anything, mock.Anything, mock.Anything).Return(nil, nil)

		err := pd.DeleteByDashboard(context.Background(), dashboard)
		assert.Nil(t, err)
	})
	t.Run("will delete pubdash when dashboard deleted", func(t *testing.T) {
		store := NewFakePublicDashboardStore(t)
		pd := &PublicDashboardServiceImpl{store: store, serviceWrapper: ProvideServiceWrapper(store)}
		dashboard := &dashboards.Dashboard{UID: "1", OrgID: 1, IsFolder: false}
		pubdash := &PublicDashboard{Uid: "2", OrgId: 1, DashboardUid: dashboard.UID}
		store.On("FindByDashboardUid", mock.Anything, mock.Anything, mock.Anything).Return(pubdash, nil)
		store.On("Delete", mock.Anything, mock.Anything, mock.Anything).Return(int64(1), nil)

		err := pd.DeleteByDashboard(context.Background(), dashboard)
		require.NoError(t, err)
	})

	t.Run("will delete pubdashes when dashboard folder deleted", func(t *testing.T) {
		store := NewFakePublicDashboardStore(t)
		pd := &PublicDashboardServiceImpl{store: store, serviceWrapper: ProvideServiceWrapper(store)}
		dashboard := &dashboards.Dashboard{UID: "1", OrgID: 1, IsFolder: true}
		pubdash1 := &PublicDashboard{Uid: "2", OrgId: 1, DashboardUid: dashboard.UID}
		pubdash2 := &PublicDashboard{Uid: "3", OrgId: 1, DashboardUid: dashboard.UID}
		store.On("FindByDashboardFolder", mock.Anything, mock.Anything).Return([]*PublicDashboard{pubdash1, pubdash2}, nil)
		store.On("Delete", mock.Anything, mock.Anything, mock.Anything).Return(int64(1), nil)
		store.On("Delete", mock.Anything, mock.Anything, mock.Anything).Return(int64(1), nil)

		err := pd.DeleteByDashboard(context.Background(), dashboard)
		require.NoError(t, err)
	})
}

func TestGenerateAccessToken(t *testing.T) {
	accessToken, err := GenerateAccessToken()

	t.Run("length", func(t *testing.T) {
		require.NoError(t, err)
		assert.Equal(t, 32, len(accessToken))
	})

	t.Run("no - ", func(t *testing.T) {
		assert.False(t, strings.Contains("-", accessToken))
	})
}

func CreateDatasource(dsType string, uid string) struct {
	Type *string `json:"type,omitempty"`
	Uid  *string `json:"uid,omitempty"`
} {
	return struct {
		Type *string `json:"type,omitempty"`
		Uid  *string `json:"uid,omitempty"`
	}{
		Type: &dsType,
		Uid:  &uid,
	}
}

func AddAnnotationsToDashboard(t *testing.T, dash *dashboards.Dashboard, annotations []DashAnnotation) *dashboards.Dashboard {
	type annotationsDto struct {
		List []DashAnnotation `json:"list"`
	}
	annos := annotationsDto{}
	annos.List = annotations
	annoJSON, err := json.Marshal(annos)
	require.NoError(t, err)

	dashAnnos, err := simplejson.NewJson(annoJSON)
	require.NoError(t, err)

	dash.Data.Set("annotations", dashAnnos)

	return dash
}

func insertTestDashboard(t *testing.T, dashboardStore dashboards.Store, title string, orgId int64,
	folderId int64, isFolder bool, templateVars []map[string]interface{}, customPanels []interface{}, tags ...interface{}) *dashboards.Dashboard {
	t.Helper()

	var dashboardPanels []interface{}
	if customPanels != nil {
		dashboardPanels = customPanels
	} else {
		dashboardPanels = []interface{}{
			map[string]interface{}{
				"id": 1,
				"datasource": map[string]interface{}{
					"uid": "ds1",
				},
				"targets": []interface{}{
					map[string]interface{}{
						"datasource": map[string]interface{}{
							"type": "mysql",
							"uid":  "ds1",
						},
						"refId": "A",
					},
					map[string]interface{}{
						"datasource": map[string]interface{}{
							"type": "prometheus",
							"uid":  "ds2",
						},
						"refId": "B",
					},
				},
			},
			map[string]interface{}{
				"id": 2,
				"datasource": map[string]interface{}{
					"uid": "ds3",
				},
				"targets": []interface{}{
					map[string]interface{}{
						"datasource": map[string]interface{}{
							"type": "mysql",
							"uid":  "ds3",
						},
						"refId": "C",
					},
				},
			},
		}
	}

	cmd := dashboards.SaveDashboardCommand{
		OrgID:    orgId,
		FolderID: folderId,
		IsFolder: isFolder,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"id":     nil,
			"title":  title,
			"tags":   tags,
			"panels": dashboardPanels,
			"templating": map[string]interface{}{
				"list": templateVars,
			},
			"time": map[string]interface{}{
				"from": "2022-09-01T00:00:00.000Z",
				"to":   "2022-09-01T12:00:00.000Z",
			},
		}),
	}
	dash, err := dashboardStore.SaveDashboard(context.Background(), cmd)
	require.NoError(t, err)
	require.NotNil(t, dash)
	dash.Data.Set("id", dash.ID)
	dash.Data.Set("uid", dash.UID)
	return dash
}
