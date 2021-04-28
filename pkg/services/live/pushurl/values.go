package pushurl

import (
	"net/url"
	"strings"
)

// UnstableSchemaFromValues extracts unstable schema tip from url values.
func UnstableSchemaFromValues(values url.Values) bool {
	key := "gf_live_unstable_schema"
	return strings.ToLower(values.Get(key)) == "true" || values.Get(key) == "1"
}

// FrameFormatFromValues extracts frame format tip from url values.
func FrameFormatFromValues(values url.Values) string {
	frameFormat := strings.ToLower(values.Get("gf_live_frame_format"))
	if frameFormat == "" {
		frameFormat = "wide"
	}
	return frameFormat
}
