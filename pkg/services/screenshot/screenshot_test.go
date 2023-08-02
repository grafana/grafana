package screenshot

import (
	"context"
	"fmt"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/setting"
)

func TestHeadlessScreenshotService(t *testing.T) {
	c := gomock.NewController(t)
	defer c.Finish()

	d := dashboards.FakeDashboardService{}
	r := rendering.NewMockService(c)
	s := NewHeadlessScreenshotService(&d, r, prometheus.NewRegistry())

	t.Run("takes a screenshot", func(t *testing.T) {
		qResult := &dashboards.Dashboard{ID: 1, UID: "foo", Slug: "bar", OrgID: 2, Data: simplejson.MustJson([]byte(`{"time":{"to":"now","from":"now-4h"}}`))}
		d.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Return(qResult, nil).Once()

		renderOpts := rendering.Opts{
			AuthOpts: rendering.AuthOpts{
				OrgID:   2,
				OrgRole: org.RoleAdmin,
			},
			ErrorOpts: rendering.ErrorOpts{
				ErrorConcurrentLimitReached: true,
				ErrorRenderUnavailable:      true,
			},
			TimeoutOpts: rendering.TimeoutOpts{
				Timeout: DefaultTimeout,
			},
			Width:           DefaultWidth,
			Height:          DefaultHeight,
			Theme:           DefaultTheme,
			Path:            "d-solo/foo/bar?from=now-6h&orgId=2&panelId=4&to=now-2h",
			ConcurrentLimit: setting.AlertingRenderLimit,
		}

		ctx := context.Background()
		opts := ScreenshotOptions{
			DashboardUID: "foo",
			PanelID:      4,
			From:         "now-6h",
			To:           "now-2h",
		}
		r.EXPECT().Render(ctx, renderOpts, nil).Return(&rendering.RenderResult{FilePath: "panel.png"}, nil)
		screenshot, err := s.Take(ctx, opts)
		require.NoError(t, err)
		assert.Equal(t, Screenshot{Path: "panel.png"}, *screenshot)
	})

	t.Run("missing To and From should use time range of the panel", func(t *testing.T) {
		qResult := &dashboards.Dashboard{ID: 1, UID: "foo", Slug: "bar", OrgID: 2, Data: simplejson.MustJson([]byte(`{"time":{"to":"now","from":"now-4h"}}`))}
		d.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Return(qResult, nil).Once()

		renderOpts := rendering.Opts{
			AuthOpts: rendering.AuthOpts{
				OrgID:   2,
				OrgRole: org.RoleAdmin,
			},
			ErrorOpts: rendering.ErrorOpts{
				ErrorConcurrentLimitReached: true,
				ErrorRenderUnavailable:      true,
			},
			TimeoutOpts: rendering.TimeoutOpts{
				Timeout: DefaultTimeout,
			},
			Width:           DefaultWidth,
			Height:          DefaultHeight,
			Theme:           DefaultTheme,
			Path:            "d-solo/foo/bar?from=now-4h&orgId=2&panelId=4&to=now",
			ConcurrentLimit: setting.AlertingRenderLimit,
		}

		ctx := context.Background()
		opts := ScreenshotOptions{
			DashboardUID: "foo",
			PanelID:      4,
		}
		r.EXPECT().Render(ctx, renderOpts, nil).Return(&rendering.RenderResult{FilePath: "panel.png"}, nil)
		screenshot, err := s.Take(ctx, opts)
		require.NoError(t, err)
		assert.Equal(t, Screenshot{Path: "panel.png"}, *screenshot)
	})

	t.Run("missing dashboard should return error", func(t *testing.T) {
		// a non-existent dashboard should return error
		d.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Return(nil, dashboards.ErrDashboardNotFound).Once()
		ctx := context.Background()
		opts := ScreenshotOptions{}
		screenshot, err := s.Take(ctx, opts)
		assert.EqualError(t, err, "Dashboard not found")
		assert.Nil(t, screenshot)
	})

	t.Run("timeout should return an error", func(t *testing.T) {
		qResult := &dashboards.Dashboard{ID: 1, UID: "foo", Slug: "bar", OrgID: 2, Data: simplejson.MustJson([]byte(`{"time":{"to":"now","from":"now-4h"}}`))}
		d.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Return(qResult, nil).Once()

		renderOpts := rendering.Opts{
			AuthOpts: rendering.AuthOpts{
				OrgID:   2,
				OrgRole: org.RoleAdmin,
			},
			ErrorOpts: rendering.ErrorOpts{
				ErrorConcurrentLimitReached: true,
				ErrorRenderUnavailable:      true,
			},
			TimeoutOpts: rendering.TimeoutOpts{
				Timeout: DefaultTimeout,
			},
			Width:           DefaultWidth,
			Height:          DefaultHeight,
			Theme:           DefaultTheme,
			Path:            "d-solo/foo/bar?from=now-4h&orgId=2&panelId=4&to=now",
			ConcurrentLimit: setting.AlertingRenderLimit,
		}

		ctx := context.Background()
		opts := ScreenshotOptions{
			DashboardUID: "foo",
			PanelID:      4,
		}
		r.EXPECT().
			Render(ctx, renderOpts, nil).
			Return(nil, rendering.ErrTimeout)
		screenshot, err := s.Take(ctx, opts)
		assert.EqualError(t, err, fmt.Sprintf("failed to take screenshot: %s", rendering.ErrTimeout))
		assert.Nil(t, screenshot)
	})
}

func TestNoOpScreenshotService(t *testing.T) {
	s := NoOpScreenshotService{}
	screenshot, err := s.Take(context.Background(), ScreenshotOptions{})
	assert.NoError(t, err)
	assert.NotNil(t, screenshot)
}

func TestScreenshotUnavailableService(t *testing.T) {
	s := ScreenshotUnavailableService{}
	screenshot, err := s.Take(context.Background(), ScreenshotOptions{})
	assert.Equal(t, err, ErrScreenshotsUnavailable)
	assert.Nil(t, screenshot)
}
