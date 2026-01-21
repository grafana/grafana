package es

import (
	"encoding/json"
	"fmt"
	"io"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

// responseParser handles parsing of Elasticsearch responses
type responseParser struct {
	logger log.Logger
}

// newResponseParser creates a new response parser
func newResponseParser(logger log.Logger) *responseParser {
	return &responseParser{
		logger: logger,
	}
}

// parseMultiSearchResponse parses a multi-search response using streaming
func (p *responseParser) parseMultiSearchResponse(body io.Reader, improvedParsingEnabled bool) (*MultiSearchResponse, error) {
	start := time.Now()

	var msr MultiSearchResponse
	var err error

	if improvedParsingEnabled {
		err = p.streamMultiSearchResponse(body, &msr)
	} else {
		dec := json.NewDecoder(body)
		err = dec.Decode(&msr)
		if err != nil {
			// Invalid JSON response from Elasticsearch
			err = backend.DownstreamError(err)
		}
	}

	if err != nil {
		p.logger.Error("Failed to decode response from Elasticsearch", "error", err, "duration", time.Since(start), "improvedParsingEnabled", improvedParsingEnabled)
		return nil, err
	}

	p.logger.Debug("Completed decoding of response from Elasticsearch", "duration", time.Since(start), "improvedParsingEnabled", improvedParsingEnabled)

	return &msr, nil
}

// streamMultiSearchResponse processes the JSON response in a streaming fashion
func (p *responseParser) streamMultiSearchResponse(body io.Reader, msr *MultiSearchResponse) error {
	dec := json.NewDecoder(body)

	_, err := dec.Token() // reads the `{` opening brace
	if err != nil {
		// Invalid JSON response from Elasticsearch
		return backend.DownstreamError(err)
	}

	for dec.More() {
		tok, err := dec.Token()
		if err != nil {
			return err
		}

		if tok == "responses" {
			_, err := dec.Token() // reads the `[` opening bracket for responses array
			if err != nil {
				return err
			}

			for dec.More() {
				var sr SearchResponse

				_, err := dec.Token() // reads `{` for each SearchResponse
				if err != nil {
					return err
				}

				for dec.More() {
					field, err := dec.Token()
					if err != nil {
						return err
					}

					switch field {
					case "hits":
						sr.Hits = &SearchResponseHits{}
						err := p.processHits(dec, &sr)
						if err != nil {
							return err
						}
					case "aggregations":
						err := dec.Decode(&sr.Aggregations)
						if err != nil {
							return err
						}
					case "error":
						err := dec.Decode(&sr.Error)
						if err != nil {
							return err
						}
					default:
						// skip over unknown fields
						err := skipUnknownField(dec)
						if err != nil {
							return err
						}
					}
				}

				msr.Responses = append(msr.Responses, &sr)

				_, err = dec.Token() // reads `}` closing for each SearchResponse
				if err != nil {
					return err
				}
			}

			_, err = dec.Token() // reads the `]` closing bracket for responses array
			if err != nil {
				return err
			}
		} else {
			err := skipUnknownField(dec)
			if err != nil {
				return err
			}
		}
	}

	_, err = dec.Token() // reads the `}` closing brace for the entire JSON
	return err
}

// processHits processes the hits in the JSON response incrementally.
func (p *responseParser) processHits(dec *json.Decoder, sr *SearchResponse) error {
	tok, err := dec.Token() // reads the `{` opening brace for the hits object
	if err != nil {
		return err
	}

	if tok != json.Delim('{') {
		return fmt.Errorf("expected '{' for hits object, got %v", tok)
	}

	for dec.More() {
		tok, err := dec.Token()
		if err != nil {
			return err
		}

		switch tok {
		case "hits":
			if err := streamHitsArray(dec, sr); err != nil {
				return err
			}
		case "total":
			var total *SearchResponseHitsTotal
			err := dec.Decode(&total)
			if err != nil {
				// It's possible that the user is using an older version of Elasticsearch (or one that doesn't return what is expected)
				// Attempt to parse the total value as an integer in this case
				totalInt := 0
				err = dec.Decode(&totalInt)
				if err == nil {
					total = &SearchResponseHitsTotal{
						Value: totalInt,
					}
				} else {
					// Log the error but do not fail the query
					backend.Logger.Debug("failed to decode total hits", "error", err)
				}
			}
			sr.Hits.Total = total
		default:
			// ignore these fields as they are not used in the current implementation
			err := skipUnknownField(dec)
			if err != nil {
				return err
			}
		}
	}

	// read the closing `}` for the hits object
	_, err = dec.Token()
	if err != nil {
		return err
	}

	return nil
}

// streamHitsArray processes the hits array field incrementally.
func streamHitsArray(dec *json.Decoder, sr *SearchResponse) error {
	tok, err := dec.Token()
	if err != nil {
		return err
	}

	// read the opening `[` for the hits array
	if tok != json.Delim('[') {
		return fmt.Errorf("expected '[' for hits array, got %v", tok)
	}

	for dec.More() {
		var hit map[string]interface{}
		err = dec.Decode(&hit)
		if err != nil {
			return err
		}

		sr.Hits.Hits = append(sr.Hits.Hits, hit)
	}

	// read the closing bracket `]` for the hits array
	tok, err = dec.Token()
	if err != nil {
		return err
	}

	if tok != json.Delim(']') {
		return fmt.Errorf("expected ']' for closing hits array, got %v", tok)
	}

	return nil
}

// skipUnknownField skips over an unknown JSON field's value in the stream.
func skipUnknownField(dec *json.Decoder) error {
	tok, err := dec.Token()
	if err != nil {
		return err
	}

	switch tok {
	case json.Delim('{'):
		// skip everything inside the object until we reach the closing `}`
		for dec.More() {
			if err := skipUnknownField(dec); err != nil {
				return err
			}
		}
		_, err = dec.Token() // read the closing `}`
		return err
	case json.Delim('['):
		// skip everything inside the array until we reach the closing `]`
		for dec.More() {
			if err := skipUnknownField(dec); err != nil {
				return err
			}
		}
		_, err = dec.Token() // read the closing `]`
		return err
	default:
		// no further action needed for primitives
		return nil
	}
}
