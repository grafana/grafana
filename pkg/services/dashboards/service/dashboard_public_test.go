//go:build integration
// +build integration

package service

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	m "github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestGetPublicDashboard(t *testing.T) {
	type storeResp struct {
		pd  *models.PublicDashboard
		d   *models.Dashboard
		err error
	}

	testCases := []struct {
		name      string
		uid       string
		storeResp *storeResp
		errResp   error
		dashResp  *models.Dashboard
	}{
		{
			name:      "returns a dashboard",
			uid:       "abc123",
			storeResp: &storeResp{pd: &models.PublicDashboard{}, d: &models.Dashboard{IsPublic: true}, err: nil},
			errResp:   nil,
			dashResp:  &models.Dashboard{IsPublic: true},
		},
		{
			name:      "returns ErrPublicDashboardNotFound when isPublic is false",
			uid:       "abc123",
			storeResp: &storeResp{pd: &models.PublicDashboard{}, d: &models.Dashboard{IsPublic: false}, err: nil},
			errResp:   models.ErrPublicDashboardNotFound,
			dashResp:  nil,
		},
		{
			name:      "returns ErrPublicDashboardNotFound if PublicDashboard missing",
			uid:       "abc123",
			storeResp: &storeResp{pd: nil, d: nil, err: nil},
			errResp:   models.ErrPublicDashboardNotFound,
			dashResp:  nil,
		},
		{
			name:      "returns ErrPublicDashboardNotFound if Dashboard missing",
			uid:       "abc123",
			storeResp: &storeResp{pd: nil, d: nil, err: nil},
			errResp:   models.ErrPublicDashboardNotFound,
			dashResp:  nil,
		},
	}

	for _, test := range testCases {
		t.Run(test.name, func(t *testing.T) {
			fakeStore := m.FakeDashboardStore{}
			service := &DashboardServiceImpl{
				log:            log.New("test.logger"),
				dashboardStore: &fakeStore,
			}
			fakeStore.On("GetPublicDashboard", mock.Anything).
				Return(test.storeResp.pd, test.storeResp.d, test.storeResp.err)

			dashboard, err := service.GetPublicDashboard(context.Background(), test.uid)
			if test.errResp != nil {
				assert.Error(t, test.errResp, err)
			} else {
				require.NoError(t, err)
			}
			assert.Equal(t, test.dashResp, dashboard)
		})
	}
}
