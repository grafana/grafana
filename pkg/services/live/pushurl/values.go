package pushurl

import (
	"net/url"
	"strings"
)

const (
	frameFormatParam = "gf_live_frame_format"
)

// FrameFormatFromValues extracts frame format tip from url values.
func FrameFormatFromValues(values url.Values) string {
	frameFormat := strings.ToLower(values.Get(frameFormatParam))
	if frameFormat == "" {
		frameFormat = "labels_column"
	}
	return frameFormat
}
