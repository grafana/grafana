package elasticsearch

import (
	"encoding/json"
	"fmt"
	"sort"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

// logsResponseProcessor handles processing of logs query responses
type logsResponseProcessor struct {
	logger log.Logger
}

// newLogsResponseProcessor creates a new logs response processor
func newLogsResponseProcessor(logger log.Logger) *logsResponseProcessor {
	return &logsResponseProcessor{
		logger: logger,
	}
}

// processLogsResponse processes logs query responses
func (p *logsResponseProcessor) processLogsResponse(res *es.SearchResponse, target *Query, configuredFields es.ConfiguredFields, queryRes *backend.DataResponse) error {
	propNames := make(map[string]bool)
	docs := make([]map[string]interface{}, len(res.Hits.Hits))
	searchWords := make(map[string]bool)

	for hitIdx, hit := range res.Hits.Hits {
		var flattened map[string]interface{}
		var sourceString string
		if hit["_source"] != nil {
			flattened = flatten(hit["_source"].(map[string]interface{}), 10)
			sourceMarshalled, err := json.Marshal(flattened)
			if err != nil {
				return err
			}
			sourceString = string(sourceMarshalled)
		}

		doc := map[string]interface{}{
			"_id":       hit["_id"],
			"_type":     hit["_type"],
			"_index":    hit["_index"],
			"sort":      hit["sort"],
			"highlight": hit["highlight"],
			// In case of logs query we want to have the raw source as a string field so it can be visualized in logs panel
			"_source": sourceString,
		}

		for k, v := range flattened {
			if configuredFields.LogLevelField != "" && k == configuredFields.LogLevelField {
				doc["level"] = v
			} else {
				doc[k] = v
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

		// we are going to add an `id` field with the concatenation of `_id` and `_index`
		_, ok := doc["id"]
		if !ok {
			doc["id"] = fmt.Sprintf("%v#%v", doc["_index"], doc["_id"])
		}

		for key := range doc {
			propNames[key] = true
		}

		// Process highlight to searchWords
		if highlights, ok := doc["highlight"].(map[string]interface{}); ok {
			for _, highlight := range highlights {
				if highlightList, ok := highlight.([]interface{}); ok {
					for _, highlightValue := range highlightList {
						str := fmt.Sprintf("%v", highlightValue)
						matches := searchWordsRegex.FindAllStringSubmatch(str, -1)

						for _, v := range matches {
							searchWords[v[1]] = true
						}
					}
				}
			}
		}

		docs[hitIdx] = doc
	}

	sortedPropNames := sortPropNames(propNames, configuredFields, true)
	fields := processDocsToDataFrameFields(docs, sortedPropNames, configuredFields)

	frames := data.Frames{}
	frame := data.NewFrame("", fields...)
	setPreferredVisType(frame, data.VisTypeLogs)

	var total int
	if res.Hits.Total != nil {
		total = res.Hits.Total.Value
	}
	setLogsCustomMeta(frame, searchWords, stringToIntWithDefaultValue(target.Metrics[0].Settings.Get("limit").MustString(), defaultSize), total)
	frames = append(frames, frame)
	queryRes.Frames = frames

	p.logger.Debug("Processed log query response", "fieldsLength", len(frame.Fields))
	return nil
}

// setLogsCustomMeta sets custom metadata for logs frames
func setLogsCustomMeta(frame *data.Frame, searchWords map[string]bool, limit int, total int) {
	i := 0
	searchWordsList := make([]string, len(searchWords))
	for searchWord := range searchWords {
		searchWordsList[i] = searchWord
		i++
	}
	sort.Strings(searchWordsList)

	if frame.Meta == nil {
		frame.Meta = &data.FrameMeta{}
	}

	if frame.Meta.Custom == nil {
		frame.Meta.Custom = map[string]interface{}{}
	}

	frame.Meta.Custom = map[string]interface{}{
		"searchWords": searchWordsList,
		"limit":       limit,
		"total":       total,
	}
}
