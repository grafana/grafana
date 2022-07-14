package screenshot

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/imguploader"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/setting"
)

func TestScreenshotOptions(t *testing.T) {
	o := ScreenshotOptions{}
	assert.Equal(t, ScreenshotOptions{}, o)

	o = o.SetDefaults()
	assert.Equal(t, ScreenshotOptions{
		Width:   DefaultWidth,
		Height:  DefaultHeight,
		Theme:   DefaultTheme,
		Timeout: DefaultTimeout,
	}, o)

	o.Width = 100
	o = o.SetDefaults()
	assert.Equal(t, ScreenshotOptions{
		Width:   100,
		Height:  DefaultHeight,
		Theme:   DefaultTheme,
		Timeout: DefaultTimeout,
	}, o)

	o.Height = 100
	o = o.SetDefaults()
	assert.Equal(t, ScreenshotOptions{
		Width:   100,
		Height:  100,
		Theme:   DefaultTheme,
		Timeout: DefaultTimeout,
	}, o)

	o.Theme = "Not a theme"
	o = o.SetDefaults()
	assert.Equal(t, ScreenshotOptions{
		Width:   100,
		Height:  100,
		Theme:   DefaultTheme,
		Timeout: DefaultTimeout,
	}, o)

	o.Timeout = DefaultTimeout + 1
	assert.Equal(t, ScreenshotOptions{
		Width:   100,
		Height:  100,
		Theme:   DefaultTheme,
		Timeout: DefaultTimeout + 1,
	}, o)
}

func TestBrowserScreenshotService(t *testing.T) {
	c := gomock.NewController(t)
	defer c.Finish()

	d := dashboards.FakeDashboardService{}
	r := rendering.NewMockService(c)
	s := NewRemoteRenderScreenshotService(&d, r)

	// a non-existent dashboard should return error
	d.On("GetDashboard", mock.Anything, mock.AnythingOfType("*models.GetDashboardQuery")).Return(models.ErrDashboardNotFound).Once()
	ctx := context.Background()
	opts := ScreenshotOptions{}
	screenshot, err := s.Take(ctx, opts)
	assert.EqualError(t, err, "Dashboard not found")
	assert.Nil(t, screenshot)

	d.On("GetDashboard", mock.Anything, mock.AnythingOfType("*models.GetDashboardQuery")).Run(func(args mock.Arguments) {
		q := args.Get(1).(*models.GetDashboardQuery)
		q.Result = &models.Dashboard{Id: 1, Uid: "foo", Slug: "bar", OrgId: 2}
	}).Return(nil)

	renderOpts := rendering.Opts{
		AuthOpts: rendering.AuthOpts{
			OrgID:   2,
			OrgRole: models.ROLE_ADMIN,
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

func TestCachableScreenshotService(t *testing.T) {
	c := gomock.NewController(t)
	defer c.Finish()

	m := NewMockScreenshotService(c)
	s := NewCachableScreenshotService(prometheus.DefaultRegisterer, time.Second, m)

	ctx := context.Background()
	opts := ScreenshotOptions{DashboardUID: "foo", PanelID: 1}

	// should be a miss and ask the mock service to take a screenshot
	m.EXPECT().Take(ctx, opts).Return(&Screenshot{Path: "panel.png"}, nil)
	screenshot, err := s.Take(ctx, opts)
	require.NoError(t, err)
	assert.Equal(t, Screenshot{Path: "panel.png"}, *screenshot)

	// should be a hit
	screenshot, err = s.Take(ctx, opts)
	require.NoError(t, err)
	assert.Equal(t, Screenshot{Path: "panel.png"}, *screenshot)

	// wait 1s and the cached screenshot should have expired
	<-time.After(time.Second)

	// should be a miss as the cached screenshot has expired
	m.EXPECT().Take(ctx, opts).Return(&Screenshot{Path: "panel.png"}, nil)
	screenshot, err = s.Take(ctx, opts)
	require.NoError(t, err)
	assert.Equal(t, Screenshot{Path: "panel.png"}, *screenshot)
}

func TestNoopScreenshotService(t *testing.T) {
	s := NoopScreenshotService{}
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

func TestSingleFlightScreenshotService(t *testing.T) {
	c := gomock.NewController(t)
	defer c.Finish()

	m := NewMockScreenshotService(c)
	s := NewSingleFlightScreenshotService(m)

	ctx := context.Background()
	opts := ScreenshotOptions{DashboardUID: "foo", PanelID: 1}

	// expect 1 invocation of the mock service for the same options
	m.EXPECT().Take(ctx, opts).
		Do(func(_ context.Context, _ ScreenshotOptions) { <-time.After(time.Second) }).
		Return(&Screenshot{Path: "panel.png"}, nil)

	var wg sync.WaitGroup
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			screenshot, err := s.Take(ctx, opts)
			require.NoError(t, err)
			assert.Equal(t, Screenshot{Path: "panel.png"}, *screenshot)
		}()
	}
	wg.Wait()

	// expect two invocations of the mock service for different dashboards
	opts1 := ScreenshotOptions{DashboardUID: "foo", PanelID: 1}
	opts2 := ScreenshotOptions{DashboardUID: "bar", PanelID: 1}
	m.EXPECT().Take(ctx, opts1).Return(&Screenshot{Path: "foo.png"}, nil)
	m.EXPECT().Take(ctx, opts2).Return(&Screenshot{Path: "bar.png"}, nil)

	wg.Add(2)
	go func() {
		defer wg.Done()
		screenshot, err := s.Take(ctx, opts1)
		require.NoError(t, err)
		assert.Equal(t, Screenshot{Path: "foo.png"}, *screenshot)
	}()
	go func() {
		defer wg.Done()
		screenshot, err := s.Take(ctx, opts2)
		require.NoError(t, err)
		assert.Equal(t, Screenshot{Path: "bar.png"}, *screenshot)
	}()
	wg.Wait()

	// expect two invocations of the mock service for different panels in the same dashboard
	opts1 = ScreenshotOptions{DashboardUID: "foo", PanelID: 1}
	opts2 = ScreenshotOptions{DashboardUID: "foo", PanelID: 2}
	m.EXPECT().Take(ctx, opts1).Return(&Screenshot{Path: "panel1.png"}, nil)
	m.EXPECT().Take(ctx, opts2).Return(&Screenshot{Path: "panel2.png"}, nil)

	wg.Add(2)
	go func() {
		defer wg.Done()
		screenshot, err := s.Take(ctx, opts1)
		require.NoError(t, err)
		assert.Equal(t, Screenshot{Path: "panel1.png"}, *screenshot)
	}()
	go func() {
		defer wg.Done()
		screenshot, err := s.Take(ctx, opts2)
		require.NoError(t, err)
		assert.Equal(t, Screenshot{Path: "panel2.png"}, *screenshot)
	}()
	wg.Wait()

	// expect two invocations of the mock service for different panels in the same dashboard
	opts1 = ScreenshotOptions{DashboardUID: "foo", PanelID: 1, Theme: models.ThemeDark}
	opts2 = ScreenshotOptions{DashboardUID: "foo", PanelID: 1, Theme: models.ThemeLight}
	m.EXPECT().Take(ctx, opts1).Return(&Screenshot{Path: "dark.png"}, nil)
	m.EXPECT().Take(ctx, opts2).Return(&Screenshot{Path: "light.png"}, nil)

	wg.Add(2)
	go func() {
		defer wg.Done()
		screenshot, err := s.Take(ctx, opts1)
		require.NoError(t, err)
		assert.Equal(t, Screenshot{Path: "dark.png"}, *screenshot)
	}()
	go func() {
		defer wg.Done()
		screenshot, err := s.Take(ctx, opts2)
		require.NoError(t, err)
		assert.Equal(t, Screenshot{Path: "light.png"}, *screenshot)
	}()
	wg.Wait()
}

func TestRateLimitScreenshotService(t *testing.T) {
	c := gomock.NewController(t)
	defer c.Finish()

	m := NewMockScreenshotService(c)
	s := NewRateLimitScreenshotService(m, 1)
	ctx := context.Background()
	opts := ScreenshotOptions{DashboardUID: "foo", PanelID: 1}

	var v int64
	for i := 0; i < 10; i++ {
		m.EXPECT().Take(ctx, opts).
			Do(func(_ context.Context, _ ScreenshotOptions) {
				// v should be 0 to show that no tokens have been acquired
				assert.Equal(t, int64(0), atomic.LoadInt64(&v))
				atomic.AddInt64(&v, 1)
				assert.Equal(t, int64(1), atomic.LoadInt64(&v))

				// interrupt so other goroutines can attempt to acquire the token
				<-time.After(time.Microsecond)

				// v should be 1 to show that no other goroutines acquired the token
				assert.Equal(t, int64(1), atomic.LoadInt64(&v))
				atomic.AddInt64(&v, -1)
				assert.Equal(t, int64(0), atomic.LoadInt64(&v))
			}).
			Return(&Screenshot{Path: "foo.png"}, nil)
	}

	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			result, err := s.Take(ctx, opts)
			require.NoError(t, err)
			assert.Equal(t, Screenshot{Path: "foo.png"}, *result)
		}()
	}
	wg.Wait()
}

func TestUploadingScreenshotService(t *testing.T) {
	c := gomock.NewController(t)
	defer c.Finish()

	m := NewMockScreenshotService(c)
	u := imguploader.NewMockImageUploader(c)
	s := NewUploadingScreenshotService(prometheus.DefaultRegisterer, m, u)

	ctx := context.Background()
	opts := ScreenshotOptions{DashboardUID: "foo", PanelID: 1}

	m.EXPECT().Take(ctx, opts).Return(&Screenshot{Path: "foo.png"}, nil)
	u.EXPECT().Upload(ctx, "foo.png").Return("https://example.com/foo.png", nil)
	screenshot, err := s.Take(ctx, opts)
	require.NoError(t, err)
	assert.Equal(t, Screenshot{
		Path: "foo.png",
		URL:  "https://example.com/foo.png",
	}, *screenshot)

	// error on upload should still return screenshot on disk
	m.EXPECT().Take(ctx, opts).Return(&Screenshot{Path: "foo.png"}, nil)
	u.EXPECT().Upload(ctx, "foo.png").Return("", errors.New("service is unavailable"))
	screenshot, err = s.Take(ctx, opts)
	assert.EqualError(t, err, "failed to upload screenshot: service is unavailable")
	assert.Equal(t, Screenshot{
		Path: "foo.png",
	}, *screenshot)
}
