package graphite

import (
	"compress/flate"
	"compress/gzip"
	"fmt"
	"io"

	"github.com/andybalholm/brotli"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

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
