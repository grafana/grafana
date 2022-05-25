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
)

func TestGetPublicDashboard(t *testing.T) {
	fakeStore := m.FakeDashboardStore{}
	service := &DashboardServiceImpl{
		log:            log.New("test.logger"),
		dashboardStore: &fakeStore,
	}

	t.Run("returns DashboardNotFound 404 when isPublic is false", func(t *testing.T) {
		fakeStore.On("GetPublicDashboard", mock.Anything).Return(nil, nil, models.ErrPublicDashboardNotFound)
		dashboard, err := service.GetPublicDashboard(context.Background(), "abc1234")
		assert.Nil(t, dashboard)
		assert.Error(t, models.ErrPublicDashboardNotFound, err)
	})

	t.Run("returns DashboardNotFound 404 when malformed uid", func(t *testing.T) {
		assert.NotNil(t, nil)
	})

	t.Run("returns DashboardNotFound 404 when missing public dashboard", func(t *testing.T) {
		assert.NotNil(t, nil)
	})

	t.Run("returns DashboardNotFound 404 when missing dashboard", func(t *testing.T) {
		assert.NotNil(t, nil)
	})

}
