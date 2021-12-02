package preview

type PreviewSize string

const (
	// PreviewSizeSquare is a small 200x200px preview
	PreviewSizeSquare PreviewSize = "square"

	// PreviewSizeLarge is a large preivew image 512x512
	PreviewSizeLarge PreviewSize = "large"

	// PreviewSizeLarge is a large preivew image 512x?
	PreviewSizeTall PreviewSize = "tall"
)

// IsKnownSize checks if the value is a standard size
func (p PreviewSize) IsKnownSize() bool {
	switch p {
	case
		PreviewSizeSquare,
		PreviewSizeLarge,
		PreviewSizeTall:
		return true
	}
	return false
}

func getPreviewSize(str string) (PreviewSize, bool) {
	switch str {
	case "s":
		fallthrough
	case string(PreviewSizeSquare):
		return PreviewSizeSquare, true
	case "l":
		fallthrough
	case string(PreviewSizeLarge):
		return PreviewSizeLarge, true
	case "t":
		fallthrough
	case string(PreviewSizeTall):
		return PreviewSizeTall, true
	}
	return PreviewSizeSquare, false
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

type dashRenderer interface {
	GetPreview(req *previewRequest) *previewResponse
}
