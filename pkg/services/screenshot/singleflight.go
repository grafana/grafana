package screenshot

import (
	"context"
	"fmt"

	"golang.org/x/sync/singleflight"
)

type captureFunc func(ctx context.Context, opts ScreenshotOptions) (*Screenshot, error)

// SingleFlight is an interface for single flighters. It prevents multiple screenshots of the same scene
// from being taken at the same time, instead taking the screenshot once and sharing it with all callers
// that requested the same scene.
//
//go:generate mockgen -destination=singleflight_mock.go -package=screenshot github.com/grafana/grafana/pkg/services/screenshot SingleFlight
type SingleFlight interface {
	// Do returns a screenshot for the options or an error. It prevents multiple screenshots with
	// the same options from being taken at the same time. Instead, the screenshot is taken once
	// and shared with all callers that requested a screenshot with the same options.
	Do(ctx context.Context, opts ScreenshotOptions, fn captureFunc) (*Screenshot, error)
}

type SingleFlighter struct {
	f singleflight.Group
}

func NewSingleFlight() SingleFlight {
	return &SingleFlighter{}
}

// Screenshot returns a screenshot or an error. It ensures that at most one screenshot
// can be taken at a time for the same dashboard and theme. Duplicate screenshots
// wait for the first screenshot to complete and receive the same screenshot.
func (s *SingleFlighter) Do(ctx context.Context, opts ScreenshotOptions, fn captureFunc) (*Screenshot, error) {
	k := fmt.Sprintf("%s-%d-%s", opts.DashboardUID, opts.PanelID, opts.Theme)

	v, err, _ := s.f.Do(k, func() (interface{}, error) {
		return fn(ctx, opts)
	})
	if err != nil {
		return nil, err
	}

	screenshot := v.(*Screenshot)
	return screenshot, nil
}
