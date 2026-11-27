package elasticsearch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"slices"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/search/enginequery"
)

type HTTPError struct {
	Status int
	body   string
}

func (e *HTTPError) Error() string {
	return fmt.Sprintf("Elasticsearch HTTP %d: %s", e.Status, e.body)
}

type NativeBackend struct {
	Client          *http.Client
	Endpoint, Index string
	Query           Object
	Order           []Sort
}

func (b *NativeBackend) Request(ctx context.Context, method, path, contentType string, body []byte, result any) error {
	req, err := http.NewRequestWithContext(ctx, method, b.Endpoint+path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", contentType)
	res, err := b.Client.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = res.Body.Close() }()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		data, err := io.ReadAll(io.LimitReader(res.Body, 8192))
		if err != nil {
			return fmt.Errorf("read Elasticsearch HTTP %d response: %w", res.StatusCode, err)
		}
		return &HTTPError{Status: res.StatusCode, body: string(data)}
	}
	if result == nil {
		_, err := io.Copy(io.Discard, res.Body)
		return err
	}
	decoder := json.NewDecoder(res.Body)
	decoder.UseNumber()
	return decoder.Decode(result)
}

func (b *NativeBackend) JSON(ctx context.Context, method, path string, body any, result any) error {
	var data []byte
	var err error
	if body != nil {
		data, err = json.Marshal(body)
		if err != nil {
			return err
		}
	}
	return b.Request(ctx, method, path, "application/json", data, result)
}

func (b *NativeBackend) Search(ctx context.Context, req enginequery.Request) (enginequery.Result, error) {
	cursor := make([]json.RawMessage, len(req.SearchAfter))
	for i, value := range req.SearchAfter {
		if !json.Valid([]byte(value)) {
			return enginequery.Result{}, fmt.Errorf("invalid Elasticsearch cursor value %q", value)
		}
		cursor[i] = json.RawMessage(value)
	}
	return b.SearchNative(ctx, b.Query, req.Size, req.Fields, cursor, req.Reverse)
}

func (b *NativeBackend) Lookup(ctx context.Context, req enginequery.LookupRequest) (enginequery.Result, error) {
	query := Object{"bool": Object{
		"must": b.Query, "filter": Object{"ids": Object{"values": req.IDs}},
	}}
	return b.SearchNative(ctx, query, len(req.IDs), req.Fields, nil, req.Reverse)
}

func (b *NativeBackend) SearchNative(ctx context.Context, query Object, size int, fields []string, cursor []json.RawMessage, reverse bool) (enginequery.Result, error) {
	order := make([]Object, len(b.Order))
	for i, field := range b.Order {
		order[i] = field.Request(reverse)
	}
	var source any = false
	if slices.Contains(fields, resource.SEARCH_FIELD_ALL_FIELDS) {
		source = true
	} else if len(fields) > 0 {
		source = fields
	}
	body := Object{
		"query": query, "sort": order, "size": size, "_source": source, "track_total_hits": true, "track_scores": true,
	}
	if len(cursor) > 0 {
		body["search_after"] = cursor
	}
	var response struct {
		Took            int64 `json:"took"`
		TimedOut        bool  `json:"timed_out"`
		TerminatedEarly bool  `json:"terminated_early"`
		Shards          struct {
			Failed int `json:"failed"`
		} `json:"_shards"`
		Hits struct {
			Total struct {
				Value    uint64 `json:"value"`
				Relation string `json:"relation"`
			} `json:"total"`
			MaxScore float64 `json:"max_score"`
			Hits     []struct {
				ID     string            `json:"_id"`
				Score  float64           `json:"_score"`
				Fields map[string]any    `json:"_source"`
				Sort   []json.RawMessage `json:"sort"`
			} `json:"hits"`
		} `json:"hits"`
	}
	if err := b.JSON(ctx, "POST", "/"+b.Index+"/_search?allow_partial_search_results=false", body, &response); err != nil {
		return enginequery.Result{}, err
	}
	if response.TimedOut || response.TerminatedEarly || response.Shards.Failed != 0 || response.Hits.Total.Relation != "eq" {
		return enginequery.Result{}, fmt.Errorf("incomplete Elasticsearch search response: timeout=%t terminated=%t failed=%d total=%s", response.TimedOut, response.TerminatedEarly, response.Shards.Failed, response.Hits.Total.Relation)
	}
	result := enginequery.Result{Total: response.Hits.Total.Value, MaxScore: response.Hits.MaxScore, Took: time.Duration(response.Took) * time.Millisecond}
	for _, hit := range response.Hits.Hits {
		if len(hit.Sort) != len(b.Order) {
			return enginequery.Result{}, fmt.Errorf("expected one sort value per field; Elasticsearch returned %d values for %d fields", len(hit.Sort), len(b.Order))
		}
		candidate := &enginequery.Hit{ID: hit.ID, Score: hit.Score, Fields: hit.Fields}
		for i, value := range hit.Sort {
			// Keep JSON scalar types intact, including null and integers above 2^53.
			candidate.Cursor = append(candidate.Cursor, string(value))
			if b.Order[i].Field != resource.SEARCH_FIELD_SCORE {
				candidate.StableSortKey = append(candidate.StableSortKey, string(value))
			}
		}
		result.Hits = append(result.Hits, candidate)
	}
	return result, nil
}

type Object = map[string]any
type Sort struct {
	Field string
	Desc  bool
}

func (s Sort) Request(reverse bool) Object {
	direction := "asc"
	if s.Desc != reverse {
		direction = "desc"
	}
	opts := Object{"order": direction}
	if s.Field != resource.SEARCH_FIELD_SCORE {
		missing := "_last"
		if reverse {
			missing = "_first"
		}
		opts["missing"] = missing
	}
	return Object{s.Field: opts}
}
