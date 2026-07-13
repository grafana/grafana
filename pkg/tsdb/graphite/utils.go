package graphite

import (
	"compress/flate"
	"compress/gzip"
	"fmt"
	"io"

	"github.com/andybalholm/brotli"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// decode reads and decompresses a resource-call response body, bounded by
// maxBytes so a large or adversarial upstream body cannot force unbounded heap
// allocation. The cap is applied after decompression, so it is also a defence
// against compression bombs. A non-positive maxBytes falls back to the default.
func decode(encoding string, original io.ReadCloser, maxBytes int64) ([]byte, error) {
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

	if maxBytes <= 0 {
		maxBytes = defaultResourceResponseMaxBytes
	}
	// Read one extra byte so a body that exactly fills the cap is distinguishable
	// from one that overflows it.
	body, err := io.ReadAll(io.LimitReader(reader, maxBytes+1))
	if err != nil {
		return nil, err
	}
	if int64(len(body)) > maxBytes {
		return nil, fmt.Errorf("resource response from Graphite exceeded %d bytes", maxBytes)
	}
	return body, nil
}
