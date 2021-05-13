package pushurl

import (
	"net/url"
	"strings"
)

const (
	unstableSchemaParam = "gf_live_unstable_schema"
	frameFormatParam    = "gf_live_frame_format"
)

// UnstableSchemaFromValues extracts unstable schema tip from url values.
func UnstableSchemaFromValues(values url.Values) bool {
	return strings.ToLower(values.Get(unstableSchemaParam)) == "true" || values.Get(unstableSchemaParam) == "1"
}

// FrameFormatFromValues extracts frame format tip from url values.
func FrameFormatFromValues(values url.Values) string {
	frameFormat := strings.ToLower(values.Get(frameFormatParam))
	if frameFormat == "" {
		frameFormat = "labels_column"
	}
	return frameFormat
}
