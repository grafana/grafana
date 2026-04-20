package graphite

import (
	"compress/flate"
	"compress/gzip"
	"fmt"
	"io"

	"github.com/andybalholm/brotli"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// logBodyMaxBytes caps the size of response/request bodies embedded in
// structured log fields. Without this cap, an oversized upstream body gets
// string-cloned into the heap at the moment we are already under memory
// pressure from the parse path.
const logBodyMaxBytes = 4 << 10

// truncateForLog returns body truncated to logBodyMaxBytes, appending an
// indicator when bytes were dropped.
func truncateForLog(body []byte) string {
	if len(body) <= logBodyMaxBytes {
		return string(body)
	}
	return string(body[:logBodyMaxBytes]) + "...[truncated]"
}

func decode(encoding string, original io.ReadCloser) ([]byte, error) {
	var reader io.Reader
	var err error
	switch encoding {
	case "gzip":
		reader, err = gzip.NewReader(original)
		if err != nil {
			return nil, err
		}
		defer func() {
			if err := reader.(io.ReadCloser).Close(); err != nil {
				backend.Logger.Warn("Failed to close reader body", "err", err)
			}
		}()
	case "deflate":
		reader = flate.NewReader(original)
		defer func() {
			if err := reader.(io.ReadCloser).Close(); err != nil {
				backend.Logger.Warn("Failed to close reader body", "err", err)
			}
		}()
	case "br":
		reader = brotli.NewReader(original)
	case "":
		reader = original
	default:
		return nil, fmt.Errorf("unexpected encoding type %v", err)
	}

	body, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}
	return body, nil
}
