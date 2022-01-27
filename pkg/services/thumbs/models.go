package thumbs

import (
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/rendering"
)

type PreviewSize string
type CrawlerMode string

const (
	// PreviewSizeThumb is a small 320x240 preview
	PreviewSizeThumb PreviewSize = "thumb"

	// PreviewSizeLarge is a large image 2000x1500
	PreviewSizeLarge PreviewSize = "large"

	// PreviewSizeLarge is a large image 512x????
	PreviewSizeTall PreviewSize = "tall"

	// CrawlerModeThumbs will create small thumbnails for everything
	CrawlerModeThumbs CrawlerMode = "thumbs"

	// CrawlerModeAnalytics will get full page results for everythign
	CrawlerModeAnalytics CrawlerMode = "analytics"

	// CrawlerModeMigrate will migrate all dashboards with old schema
	CrawlerModeMigrate CrawlerMode = "migrate"
)

// IsKnownSize checks if the value is a standard size
func (p PreviewSize) IsKnownSize() bool {
	switch p {
	case
		PreviewSizeThumb,
		PreviewSizeLarge,
		PreviewSizeTall:
		return true
	}
	return false
}

func getPreviewSize(str string) (PreviewSize, bool) {
	switch str {
	case string(PreviewSizeThumb):
		return PreviewSizeThumb, true
	case string(PreviewSizeLarge):
		return PreviewSizeLarge, true
	case string(PreviewSizeTall):
		return PreviewSizeTall, true
	}
	return PreviewSizeThumb, false
}

func getTheme(str string) (rendering.Theme, bool) {
	switch str {
	case "light":
		return rendering.ThemeLight, true
	case "dark":
		return rendering.ThemeDark, true
	}
	return rendering.ThemeDark, false
}

type previewRequest struct {
	OrgID int64           `json:"orgId"`
	UID   string          `json:"uid"`
	Size  PreviewSize     `json:"size"`
	Theme rendering.Theme `json:"theme"`
}

type previewResponse struct {
	Code int    `json:"code"` // 200 | 202
	Path string `json:"path"` // local file path to serve
	URL  string `json:"url"`  // redirect to this URL
}

type crawlCmd struct {
	Mode  CrawlerMode     `json:"mode"`  // thumbs | analytics | migrate
	Theme rendering.Theme `json:"theme"` // light | dark
}

type crawlStatus struct {
	State    string    `json:"state"`
	Started  time.Time `json:"started,omitempty"`
	Finished time.Time `json:"finished,omitempty"`
	Complete int       `json:"complete"`
	Errors   int       `json:"errors"`
	Queue    int       `json:"queue"`
	Last     time.Time `json:"last,omitempty"`
}

type dashRenderer interface {
	// Assumes you have already authenticated as admin
	GetPreview(req *previewRequest) *previewResponse

	// Assumes you have already authenticated as admin
	Start(c *models.ReqContext, mode CrawlerMode, theme rendering.Theme) (crawlStatus, error)

	// Assumes you have already authenticated as admin
	Stop() (crawlStatus, error)

	// Assumes you have already authenticated as admin
	Status() (crawlStatus, error)
}
