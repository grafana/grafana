package screenshot

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSingleFlighter(t *testing.T) {
	c := gomock.NewController(t)
	defer c.Finish()

	s := NewSingleFlight()
	m := NewMockScreenshotService(c)
	ctx := context.Background()
	opts := ScreenshotOptions{DashboardUID: "foo", PanelID: 1}

	// expect
	m.EXPECT().Take(ctx, opts).
		Do(func(_ context.Context, _ ScreenshotOptions) { <-time.After(time.Second) }).
		Return(&Screenshot{Path: "panel.png"}, nil)

	var wg sync.WaitGroup
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			screenshot, err := s.Do(ctx, opts, m.Take)
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
		screenshot, err := s.Do(ctx, opts1, m.Take)
		require.NoError(t, err)
		assert.Equal(t, Screenshot{Path: "foo.png"}, *screenshot)
	}()
	go func() {
		defer wg.Done()
		screenshot, err := s.Do(ctx, opts2, m.Take)
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
		screenshot, err := s.Do(ctx, opts1, m.Take)
		require.NoError(t, err)
		assert.Equal(t, Screenshot{Path: "panel1.png"}, *screenshot)
	}()
	go func() {
		defer wg.Done()
		screenshot, err := s.Do(ctx, opts2, m.Take)
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
		screenshot, err := s.Do(ctx, opts1, m.Take)
		require.NoError(t, err)
		assert.Equal(t, Screenshot{Path: "dark.png"}, *screenshot)
	}()
	go func() {
		defer wg.Done()
		screenshot, err := s.Do(ctx, opts2, m.Take)
		require.NoError(t, err)
		assert.Equal(t, Screenshot{Path: "light.png"}, *screenshot)
	}()
	wg.Wait()
}
