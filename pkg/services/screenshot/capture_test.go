package screenshot

import (
	"context"
	"fmt"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/setting"
)

func TestHeadlessCaptureService(t *testing.T) {
	c := gomock.NewController(t)
	defer c.Finish()

	d := dashboards.FakeDashboardService{}
	r := rendering.NewMockService(c)
	s := NewHeadlessCaptureService(&d, r)

	// a non-existent dashboard should return error
	d.On("GetDashboard", mock.Anything, mock.AnythingOfType("*models.GetDashboardQuery")).Return(dashboards.ErrDashboardNotFound).Once()
	ctx := context.Background()
	opts := ScreenshotOptions{}
	screenshot, err := s.Screenshot(ctx, opts)
	assert.EqualError(t, err, "Dashboard not found")
	assert.Nil(t, screenshot)

	d.On("GetDashboard", mock.Anything, mock.AnythingOfType("*models.GetDashboardQuery")).Run(func(args mock.Arguments) {
		q := args.Get(1).(*models.GetDashboardQuery)
		q.Result = &models.Dashboard{Id: 1, Uid: "foo", Slug: "bar", OrgId: 2}
	}).Return(nil)

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
		Path:            "d-solo/foo/bar?orgId=2&panelId=4",
		ConcurrentLimit: setting.AlertingRenderLimit,
	}

	opts.DashboardUID = "foo"
	opts.PanelID = 4
	r.EXPECT().
		Render(ctx, renderOpts, nil).
		Return(&rendering.RenderResult{FilePath: "panel.png"}, nil)
	screenshot, err = s.Screenshot(ctx, opts)
	require.NoError(t, err)
	assert.Equal(t, Screenshot{Path: "panel.png"}, *screenshot)

	// a timeout should return error
	r.EXPECT().
		Render(ctx, renderOpts, nil).
		Return(nil, rendering.ErrTimeout)
	screenshot, err = s.Screenshot(ctx, opts)
	assert.EqualError(t, err, fmt.Sprintf("failed to take screenshot: %s", rendering.ErrTimeout))
	assert.Nil(t, screenshot)
}
