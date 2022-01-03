package thumbs

import "encoding/json"

type PreviewSize string

const (
	// PreviewSizeThumb is a small 320x240 preview
	PreviewSizeThumb PreviewSize = "thumb"

	// PreviewSizeLarge is a large image 2000x1500
	PreviewSizeLarge PreviewSize = "large"

	// PreviewSizeLarge is a large image 512x????
	PreviewSizeTall PreviewSize = "tall"
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

func getTheme(str string) (string, bool) {
	switch str {
	case "light":
		return str, true
	case "dark":
		return str, true
	}
	return "dark", false
}

type previewRequest struct {
	Kind  string      `json:"kind"`
	OrgID int64       `json:"orgId"`
	UID   string      `json:"uid"`
	Size  PreviewSize `json:"size"`
	Theme string      `json:"theme"`
}

type previewResponse struct {
	Code int    `json:"code"` // 200 | 202
	Path string `json:"path"` // local file path to serve
	URL  string `json:"url"`  // redirect to this URL
}

// export enum CrawlerMode {
// 	Thumbs = 'thumbs',
// 	Analytics = 'analytics', // Enterprise only
// 	Migrate = 'migrate',
//   }

//   export enum CrawlerAction {
// 	Run = 'run',
// 	Stop = 'stop',
// 	Queue = 'queue', // TODO (later!) move some to the front
//   }

type crawlCmd struct {
	Mode        string `json:"mode"`        // thumbs | analytics | migrate
	Action      string `json:"action"`      // run | stop | queue
	Theme       string `json:"theme"`       // light | dark
	User        string `json:"user"`        // :(
	Password    string `json:"password"`    // :(
	Concurrency int    `json:"concurrency"` // number of pages to run in parallel

	Path string `json:"path"` // eventually for queue
}

type crawConfig struct {
	crawlCmd

	// Sent to the crawler with each command
	URL               string `json:"url"`
	ScreenshotsFolder string `json:"screenshotsFolder"`
}

type dashRenderer interface {
	// Assumes you have already authenticated as admin
	GetPreview(req *previewRequest) *previewResponse

	// Assumes you have already authenticated as admin
	CrawlerCmd(cfg *crawlCmd) (json.RawMessage, error)
}
