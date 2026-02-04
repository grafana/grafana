package elasticsearch

import (
	"encoding/json"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

// rawResponseProcessor handles processing of raw data and raw document query responses
type rawResponseProcessor struct {
	logger log.Logger
}

// newRawResponseProcessor creates a new raw response processor
func newRawResponseProcessor(logger log.Logger) *rawResponseProcessor {
	return &rawResponseProcessor{
		logger: logger,
	}
}

// processRawDataResponse processes raw data query responses
func (p *rawResponseProcessor) processRawDataResponse(res *es.SearchResponse, target *Query, configuredFields es.ConfiguredFields, queryRes *backend.DataResponse) error {
	propNames := make(map[string]bool)
	docs := make([]map[string]interface{}, len(res.Hits.Hits))

	for hitIdx, hit := range res.Hits.Hits {
		var flattened map[string]interface{}
		if hit["_source"] != nil {
			flattened = flatten(hit["_source"].(map[string]interface{}), 10)
		}

		doc := map[string]interface{}{
			"_id":       hit["_id"],
			"_type":     hit["_type"],
			"_index":    hit["_index"],
			"sort":      hit["sort"],
			"highlight": hit["highlight"],
		}

		for k, v := range flattened {
			doc[k] = v
		}

		if hit["fields"] != nil {
			source, ok := hit["fields"].(map[string]interface{})
			if ok {
				for k, v := range source {
					doc[k] = v
				}
			}
		}

		for key := range doc {
			propNames[key] = true
		}

		docs[hitIdx] = doc
	}

	sortedPropNames := sortPropNames(propNames, configuredFields, false)
	fields := processDocsToDataFrameFields(docs, sortedPropNames, configuredFields)

	frames := data.Frames{}
	frame := data.NewFrame("", fields...)

	frames = append(frames, frame)
	queryRes.Frames = frames

	p.logger.Debug("Processed raw data query response", "fieldsLength", len(frame.Fields))
	return nil
}

// processRawDocumentResponse processes raw document query responses
func (p *rawResponseProcessor) processRawDocumentResponse(res *es.SearchResponse, target *Query, queryRes *backend.DataResponse) error {
	docs := make([]map[string]interface{}, len(res.Hits.Hits))
	for hitIdx, hit := range res.Hits.Hits {
		doc := map[string]interface{}{
			"_id":       hit["_id"],
			"_type":     hit["_type"],
			"_index":    hit["_index"],
			"sort":      hit["sort"],
			"highlight": hit["highlight"],
		}

		if hit["_source"] != nil {
			source, ok := hit["_source"].(map[string]interface{})
			if ok {
				for k, v := range source {
					doc[k] = v
				}
			}
		}

		if hit["fields"] != nil {
			source, ok := hit["fields"].(map[string]interface{})
			if ok {
				for k, v := range source {
					doc[k] = v
				}
			}
		}

		docs[hitIdx] = doc
	}

	fieldVector := make([]*json.RawMessage, len(res.Hits.Hits))
	for i, doc := range docs {
		bytes, err := json.Marshal(doc)
		if err != nil {
			// We skip docs that can't be marshalled
			// should not happen
			continue
		}
		value := json.RawMessage(bytes)
		fieldVector[i] = &value
	}

	isFilterable := true
	field := data.NewField(target.RefID, nil, fieldVector)
	field.Config = &data.FieldConfig{Filterable: &isFilterable}

	frames := data.Frames{}
	frame := data.NewFrame(target.RefID, field)
	frames = append(frames, frame)

	queryRes.Frames = frames
	p.logger.Debug("Processed raw document query response", "fieldsLength", len(frame.Fields))
	return nil
}
