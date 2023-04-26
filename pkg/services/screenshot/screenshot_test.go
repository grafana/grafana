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

	// a non-existent dashboard should return error
	d.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Return(nil, dashboards.ErrDashboardNotFound).Once()
	ctx := context.Background()
	opts := ScreenshotOptions{}
	screenshot, err := s.Take(ctx, opts)
	assert.EqualError(t, err, "Dashboard not found")
	assert.Nil(t, screenshot)

	// should take a screenshot
	qResult := &dashboards.Dashboard{ID: 1, UID: "foo", Slug: "bar", OrgID: 2}
	d.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Return(qResult, nil)

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

	opts.From = "now-6h"
	opts.To = "now-2h"
	opts.DashboardUID = "foo"
	opts.PanelID = 4
	r.EXPECT().
		Render(ctx, renderOpts, nil).
		Return(&rendering.RenderResult{FilePath: "panel.png"}, nil)
	screenshot, err = s.Take(ctx, opts)
	require.NoError(t, err)
	assert.Equal(t, Screenshot{Path: "panel.png"}, *screenshot)

	// a timeout should return error
	r.EXPECT().
		Render(ctx, renderOpts, nil).
		Return(nil, rendering.ErrTimeout)
	screenshot, err = s.Take(ctx, opts)
	assert.EqualError(t, err, fmt.Sprintf("failed to take screenshot: %s", rendering.ErrTimeout))
	assert.Nil(t, screenshot)
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
