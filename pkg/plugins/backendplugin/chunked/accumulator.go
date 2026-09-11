package chunked

import (
	"errors"
	"fmt"
	"io"

	"github.com/go-json-experiment/json/jsontext"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/datasourcetest"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

// Read JSON lines into a full QueryDataResponse (useful for testing)
func AccumulateJSONLines(jsonl io.Reader) (*backend.QueryDataResponse, error) {
	return datasourcetest.AccumulateJSON(func(yield func(*pluginv2.QueryChunkedDataResponse, error) bool) {
		decoder := jsontext.NewDecoder(jsonl, jsontext.AllowDuplicateNames(true))
		for {
			err := readToken(decoder, jsontext.KindBeginObject)
			if err != nil {
				if errors.Is(err, io.EOF) {
					return
				}
				yield(nil, err)
				return
			}

			var val jsontext.Value
			var keyTok jsontext.Token
			chunk := &pluginv2.QueryChunkedDataResponse{
				Format: pluginv2.DataFrameFormat_JSON,
			}

			for decoder.PeekKind() != '}' {
				keyTok, err = decoder.ReadToken()
				if err != nil {
					yield(nil, err)
					return
				}
				key := keyTok.String()

				switch key {
				case "refId":
					chunk.RefId, err = readStringValue(decoder)
				case "frameId":
					chunk.FrameId, err = readStringValue(decoder)
				case "error":
					chunk.Error, err = readStringValue(decoder)
				case "errorSource":
					chunk.ErrorSource, err = readStringValue(decoder)

				case "frame":
					val, err = decoder.ReadValue()
					if err == nil {
						// This needs to clone because the same buffer is used for PeekKind()
						chunk.Frame, err = val.Clone().MarshalJSON()
					}

				default:
					err = fmt.Errorf("unsupported property: %s (offset:%d)", key, decoder.InputOffset())
				}
			}

			if err == nil {
				err = readToken(decoder, jsontext.KindEndObject)
			}

			// Stop iterating on error
			if err != nil {
				yield(nil, err)
				return
			}

			if !yield(chunk, nil) {
				return // Caller stopped iterating
			}
		}
	})
}

// helper function to read a specific expected token
func readToken(d *jsontext.Decoder, expected jsontext.Kind) error {
	tok, err := d.ReadToken()
	if err != nil {
		return err
	}
	if tok.Kind() != expected {
		return fmt.Errorf("expected %v, got %v", expected, tok.Kind())
	}
	return nil
}

func readStringValue(d *jsontext.Decoder) (string, error) {
	val, err := d.ReadToken()
	if err != nil {
		return "", err
	}
	if val.Kind() != '"' {
		return "", fmt.Errorf("expected string")
	}
	return val.String(), nil
}
