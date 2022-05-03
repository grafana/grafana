package searchV2

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/blugelabs/bluge"
	"github.com/blugelabs/bluge/search"
	"github.com/blugelabs/bluge/search/aggregations"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func initBlugeIndex(ctx context.Context, i *dashboardIndex, orgID int64) (*bluge.Reader, error) {
	config := bluge.InMemoryOnlyConfig()

	// open an index writer using the configuration
	writer, err := bluge.OpenWriter(config)
	if err != nil {
		return nil, fmt.Errorf("error opening writer: %v", err)
	}
	defer func() {
		err = writer.Close()
		if err != nil {
			i.logger.Error("Error closing bluge writer", "error", err)
		}
	}()

	start := time.Now()

	// Avoid cache here.
	dashboards, err := i.loader.LoadDashboards(ctx, orgID, "")
	if err != nil {
		return nil, fmt.Errorf("can't build dashboard search index for org ID: %d // %w", orgID, err)
	}

	folderIdLookup := make(map[int64]string, 50)
	folderIdLookup[0] = "general" // automatic
	for _, dashboard := range dashboards {
		if dashboard.isFolder && dashboard.uid != "" {
			folderIdLookup[dashboard.id] = dashboard.uid
		}
	}

	i.logger.Info("Loading dashboards for bluge index", "elapsed", time.Since(start), "numDashboards", len(dashboards))
	label := time.Now()

	batch := bluge.NewBatch()

	for _, dashboard := range dashboards {
		path := dashboard.uid
		url := fmt.Sprintf("/d/%s/%s", dashboard.uid, dashboard.slug)
		if dashboard.isFolder {
			if dashboard.id == 0 {
				path = folderIdLookup[0]
				url = "/dashboards"
			} else {
				url = fmt.Sprintf("/dashboards/f/%s/%s", dashboard.uid, dashboard.slug)
			}
		} else {
			folderUID, ok := folderIdLookup[dashboard.folderID]
			if ok {
				path = fmt.Sprintf("%s/%s", folderUID, dashboard.uid)
			}

			for _, panel := range dashboard.info.Panels {
				uid := dashboard.uid + "#" + strconv.FormatInt(panel.ID, 10)
				doc := bluge.NewDocument(uid).
					AddField(bluge.NewKeywordField("url", fmt.Sprintf("%s?viewPanel=%d", url, panel.ID)).StoreValue()).
					AddField(bluge.NewTextField("name", panel.Title).StoreValue().SearchTermPositions()).
					AddField(bluge.NewTextField("description", panel.Description).SearchTermPositions()).
					AddField(bluge.NewKeywordField("path", fmt.Sprintf("%s#%d", path, panel.ID)).StoreValue()). // eventually special tokenizer
					AddField(bluge.NewKeywordField("type", panel.Type).Aggregatable().StoreValue()).
					AddField(bluge.NewKeywordField(documentFieldKind, "panel").Aggregatable().StoreValue()) // likely want independent index for this
				batch.Insert(doc)
			}
		}

		// Then document
		doc := bluge.NewDocument(dashboard.uid).
			AddField(bluge.NewKeywordField("url", url).StoreValue()).
			AddField(bluge.NewKeywordField("path", path).Sortable().StoreValue()).
			AddField(bluge.NewTextField("name", dashboard.info.Title).StoreValue().SearchTermPositions()).
			AddField(bluge.NewTextField("description", dashboard.info.Description).SearchTermPositions()).
			AddField(bluge.NewNumericField("panelCount", float64(len(dashboard.info.Panels))).Aggregatable().StoreValue())

		for _, tag := range dashboard.info.Tags {
			doc.AddField(bluge.NewKeywordField("tags", tag).
				StoreValue().
				Aggregatable().
				SearchTermPositions())
		}

		for _, ds := range dashboard.info.Datasource {
			if ds.UID != "" {
				doc.AddField(bluge.NewKeywordField("ds_uid", ds.UID).
					StoreValue().
					Aggregatable().
					SearchTermPositions())
			}
			if ds.Type != "" {
				doc.AddField(bluge.NewKeywordField("ds_type", ds.Type).
					StoreValue().
					Aggregatable().
					SearchTermPositions())
			}
		}

		if dashboard.isFolder {
			doc.AddField(bluge.NewKeywordField(documentFieldKind, "folder").Aggregatable().StoreValue()) // likely want independent index for this
		} else {
			doc.AddField(bluge.NewKeywordField(documentFieldKind, "dashboard").Aggregatable().StoreValue()) // likely want independent index for this
		}
		batch.Insert(doc)
	}

	i.logger.Info("Inserting documents into bluge batch", "elapsed", time.Since(label))
	label = time.Now()

	err = writer.Batch(batch)
	if err != nil {
		return nil, err
	}

	reader, err := writer.Reader()
	if err != nil {
		return nil, err
	}

	i.logger.Info("Inserting batch into bluge writer", "elapsed", time.Since(label))
	i.logger.Info("Finish building bluge index", "totalElapsed", time.Since(start))
	return reader, err
}

func doBlugeQuery(ctx context.Context, s *StandardSearchService, reader *bluge.Reader, filter ResourceFilter, q DashboardQuery) *backend.DataResponse {
	response := &backend.DataResponse{}

	doExplain := false
	perm := newPermissionFilter(filter, s.logger)

	var req bluge.SearchRequest
	idx := strings.Index(q.Query, ":")
	if idx > 0 {
		key := q.Query[:idx]
		arg := q.Query[idx+1:]
		switch key {
		case "stared":
			response.Error = fmt.Errorf("TODO: get stared items :(")
			return response
		case "uids":
			bq := bluge.NewBooleanQuery()
			for _, uid := range strings.Split(arg, ",") {
				if filter(uid) {
					bq.AddShould(bluge.NewTermQuery(uid).SetField(documentFieldId))
				}
			}
			req = bluge.NewAllMatches(bq) // no sorting!

		case "ids":
			ids := strings.Split(arg, ",")
			response.Error = fmt.Errorf("TODO: get items with ids: %v", ids) // Needed for migrations!!!
			return response
		default:
			response.Error = fmt.Errorf("invalid query")
			return response
		}
	} else if q.Query == "*" { // Match folders and dashboards
		bq := bluge.NewBooleanQuery().
			AddShould(bluge.NewMatchAllQuery()).
			AddMust(bluge.NewBooleanQuery().
				AddShould(bluge.NewTermQuery("folder").SetField(documentFieldKind)).
				AddShould(bluge.NewTermQuery("dashboard").SetField(documentFieldKind))).
			AddMust(perm)

		if q.Query == "?" {
			req = bluge.NewAllMatches(bq) // no sorting!
		} else {
			req = bluge.NewTopNSearch(50000, bq).
				SortBy([]string{"path", "name"})
		}
	} else {
		bq := bluge.NewBooleanQuery().
			AddShould(bluge.NewMatchPhraseQuery(q.Query).SetField("name").SetBoost(6)).
			AddShould(bluge.NewMatchPhraseQuery(q.Query).SetField("description").SetBoost(3)).
			AddShould(bluge.NewPrefixQuery(q.Query).SetField("name").SetBoost(1))

		if len(q.Query) > 4 {
			bq.AddShould(bluge.NewFuzzyQuery(q.Query).SetField("name")).SetBoost(1.5)
		}

		// Wrap with permissions
		bq = bluge.NewBooleanQuery().
			AddMust(bq).
			AddMust(perm)

		req = bluge.NewTopNSearch(100, bq).
			WithStandardAggregations().
			ExplainScores().
			SortBy([]string{"-_score", "name"})
		doExplain = true

		s.logger.Info("RUN QUERY", "q", q)
	}

	termAggs := []string{"type", documentFieldKind, "tags", "ds_uid", "ds_type"}
	for _, t := range termAggs {
		req.AddAggregation(t, aggregations.NewTermsAggregation(search.Field(t), 50))
	}

	// execute this search on the reader
	documentMatchIterator, err := reader.Search(context.Background(), req)
	if err != nil {
		s.logger.Error("error executing search: %v", err)
		response.Error = err
		return response
	}

	dvfieldNames := []string{"type"}
	sctx := search.NewSearchContext(0, 0)

	// numericFields := map[string]bool{"schemaVersion": true, "panelCount": true}

	fHitNumber := data.NewFieldFromFieldType(data.FieldTypeInt32, 0)
	fScore := data.NewFieldFromFieldType(data.FieldTypeFloat64, 0)
	fKind := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fUID := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fPath := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fType := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fName := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fURL := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fTags := data.NewFieldFromFieldType(data.FieldTypeNullableJSON, 0)
	fExplain := data.NewFieldFromFieldType(data.FieldTypeNullableJSON, 0)

	fHitNumber.Name = "Hit"
	fScore.Name = "Score"
	fKind.Name = "Kind"
	fUID.Name = "UID"
	fPath.Name = "Path"
	fType.Name = "Type"
	fName.Name = "Name"
	fURL.Name = "URL"
	fURL.Config = &data.FieldConfig{
		Links: []data.DataLink{
			{Title: "link", URL: "${__value.text}"},
		},
	}
	fTags.Name = "Tags"
	fExplain.Name = "Explain"

	frame := data.NewFrame("Query results", fHitNumber, fScore, fKind, fUID, fPath, fType, fName, fURL, fTags)
	if doExplain {
		frame.Fields = append(frame.Fields, fExplain)
	}

	// iterate through the document matches
	match, err := documentMatchIterator.Next()
	for err == nil && match != nil {
		err = match.LoadDocumentValues(sctx, dvfieldNames)
		if err != nil {
			continue
		}

		uid := ""
		kind := ""
		ptype := ""
		name := ""
		url := ""
		path := ""
		var tags []string

		err = match.VisitStoredFields(func(field string, value []byte) bool {
			// if numericFields[field] {
			// 	num, err2 := bluge.DecodeNumericFloat64(value)
			// 	if err2 != nil {
			// 		vals[field] = num
			// 	}
			// } else {
			// 	vals[field] = string(value)
			// }

			switch field {
			case "_id":
				uid = string(value)
			case documentFieldKind:
				kind = string(value)
			case "type":
				ptype = string(value)
			case "name":
				name = string(value)
			case "url":
				url = string(value)
			case "path":
				path = string(value)
			case "tags":
				tags = append(tags, string(value))
			}
			return true
		})
		if err != nil {
			s.logger.Error("error loading stored fields: %v", err)
			response.Error = err
			return response
		}

		fHitNumber.Append(int32(match.HitNumber))
		fScore.Append(match.Score)
		fKind.Append(kind)
		fUID.Append(uid)
		fPath.Append(path)
		fType.Append(ptype)
		fName.Append(name)
		fURL.Append(url)

		if len(tags) > 0 {
			js, _ := json.Marshal(tags)
			jsb := json.RawMessage(js)
			fTags.Append(&jsb)
		} else {
			fTags.Append(nil)
		}

		if doExplain {
			if match.Explanation != nil {
				js, _ := json.Marshal(&match.Explanation)
				jsb := json.RawMessage(js)
				fExplain.Append(&jsb)
			} else {
				fExplain.Append(nil)
			}
		}

		// load the next document match
		match, err = documentMatchIterator.Next()
	}

	// Must call after iterating :)
	aggs := documentMatchIterator.Aggregations()
	s.logger.Info("Query finished",
		"count", aggs.Count(),
		"max_score", aggs.Metric("max_score"),
		"time", aggs.Duration(),
		"name", aggs.Name())

	response.Frames = append(response.Frames, frame)

	for _, k := range termAggs {
		bbb := aggs.Buckets(k)
		if bbb != nil {
			size := len(bbb)

			fName := data.NewFieldFromFieldType(data.FieldTypeString, size)
			fName.Name = k

			fCount := data.NewFieldFromFieldType(data.FieldTypeUint64, size)
			fCount.Name = "Count"

			for i, v := range bbb {
				fName.Set(i, v.Name())
				fCount.Set(i, v.Count())
			}

			response.Frames = append(response.Frames, data.NewFrame("Facet: "+k, fName, fCount))
		}
	}

	return response
}
