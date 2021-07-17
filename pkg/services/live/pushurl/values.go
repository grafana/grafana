package pushurl

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/grafana/grafana/pkg/services/live/telemetry/telegraf"
)

const (
	frameFormatParam = "gf_live_frame_format"
)

// FrameFormatFromValues extracts frame format tip from url values.
func FrameFormatFromValues(values url.Values) (telegraf.ConverterFrameType, error) {
	frameFormat := strings.ToLower(values.Get(frameFormatParam))
	switch frameFormat {
	case "wide":
		return telegraf.FrameTypeWide, nil
	case "", "labels_column":
		return telegraf.FrameTypeLabelsColumn, nil
	case "prometheus":
		return telegraf.FrameTypePrometheus, nil
	default:
		return "", fmt.Errorf("unsuported frame format: %s", frameFormat)
	}
}
