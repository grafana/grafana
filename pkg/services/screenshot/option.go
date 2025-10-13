package screenshot

import (
	"hash/fnv"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

var (
	DefaultHeight  = 500
	DefaultWidth   = 1000
	DefaultTheme   = models.ThemeDark
	DefaultTimeout = 15 * time.Second
)

// ScreenshotOptions are the options for taking a screenshot.
type ScreenshotOptions struct {
	// OrgID, DashboardUID and PanelID are required.
	OrgID        int64
	DashboardUID string
	PanelID      int64

	// These are optional. From and To must both be set to take effect.
	// Width, Height, Theme and Timeout inherit their defaults from
	// DefaultWidth, DefaultHeight, DefaultTheme and DefaultTimeout.
	From    string
	To      string
	Width   int
	Height  int
	Theme   models.Theme
	Timeout time.Duration
}

// SetDefaults sets default values for missing or invalid options.
func (s ScreenshotOptions) SetDefaults() ScreenshotOptions {
	if s.Width <= 0 {
		s.Width = DefaultWidth
	}
	if s.Height <= 0 {
		s.Height = DefaultHeight
	}
	switch s.Theme {
	case models.ThemeDark, models.ThemeLight:
	default:
		s.Theme = DefaultTheme
	}
	if s.Timeout <= 0 {
		s.Timeout = DefaultTimeout
	}
	return s
}

func (s ScreenshotOptions) Hash() []byte {
	h := fnv.New64()
	_, _ = h.Write([]byte(strconv.FormatInt(s.OrgID, 10)))
	_, _ = h.Write([]byte(s.DashboardUID))
	_, _ = h.Write([]byte(strconv.FormatInt(s.PanelID, 10)))
	_, _ = h.Write([]byte(s.From))
	_, _ = h.Write([]byte(s.To))
	_, _ = h.Write([]byte(strconv.FormatInt(int64(s.Width), 10)))
	_, _ = h.Write([]byte(strconv.FormatInt(int64(s.Height), 10)))
	_, _ = h.Write([]byte(s.Theme))
	return h.Sum(nil)
}
