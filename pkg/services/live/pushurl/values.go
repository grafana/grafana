package pushurl

import (
	"net/url"
	"strings"
)

func StableSchemaFromValues(values url.Values) bool {
	key := "gf_live_stable_schema"
	return strings.ToLower(values.Get(key)) == "true" || values.Get(key) == "1"
}

func FrameFormatFromValues(values url.Values) string {
	frameFormat := strings.ToLower(values.Get("gf_live_frame_format"))
	if frameFormat == "" {
		frameFormat = "wide"
	}
	return frameFormat
}
