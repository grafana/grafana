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
	"github.com/grafana/grafana/pkg/infra/log"
)

const (
	documentFieldUID         = "_id" // actually UID!! but bluge likes "_id"
	documentFieldKind        = "kind"
	documentFieldTag         = "tag"
	documentFieldURL         = "url"
	documentFieldName        = "name"
	documentFieldDescription = "description"
	documentFieldLocation    = "location" // parent path
	documentFieldPanelType   = "panel_type"
	documentFieldDSUID       = "ds_uid"
	documentFieldDSType      = "ds_type"
	documentFieldInternalID  = "__internal_id" // only for migrations! (indexed as a string)
)

func initBlugeIndex(dashboards []dashboard, logger log.Logger) (*bluge.Reader, error) {
	config := bluge.InMemoryOnlyConfig()

	// open an index writer using the configuration
	writer, err := bluge.OpenWriter(config)
	if err != nil {
		return nil, fmt.Errorf("error opening writer: %v", err)
	}
	defer func() {
		err = writer.Close()
		if err != nil {
			logger.Error("Error closing bluge writer", "error", err)
		}
	}()

	start := time.Now()

	logger.Info("Loading dashboards for bluge index", "elapsed", time.Since(start), "numDashboards", len(dashboards))
	label := time.Now()

	batch := bluge.NewBatch()

	// First index the folders
	folderIdLookup := make(map[int64]string, 50)
	for _, dashboard := range dashboards {
		if !dashboard.isFolder {
			continue
		}
		uid := dashboard.uid
		url := fmt.Sprintf("/dashboards/f/%s/%s", dashboard.uid, dashboard.slug)
		if uid == "" {
			uid = "general"
			url = "/dashboards"
			dashboard.info.Title = "General"
			dashboard.info.Description = ""

			// ARRRG, why is this not in the final index?!!
		}

		doc := bluge.NewDocument(uid).
			AddField(bluge.NewKeywordField(documentFieldKind, string(entityKindFolder)).Aggregatable().StoreValue()).
			AddField(bluge.NewKeywordField(documentFieldURL, url).StoreValue()).
			AddField(bluge.NewTextField(documentFieldName, dashboard.info.Title).StoreValue().SearchTermPositions()).
			AddField(bluge.NewTextField(documentFieldDescription, dashboard.info.Description).SearchTermPositions())

		batch.Insert(doc)

		folderIdLookup[dashboard.id] = uid
	}

	// Then each dashboard
	for _, dashboard := range dashboards {
		if dashboard.isFolder {
			continue
		}

		url := fmt.Sprintf("/d/%s/%s", dashboard.uid, dashboard.slug)
		folderUID := folderIdLookup[dashboard.folderID]
		location := folderUID

		// Dashboard document
		doc := bluge.NewDocument(dashboard.uid).
			AddField(bluge.NewKeywordField(documentFieldKind, string(entityKindDashboard)).Aggregatable().StoreValue()).
			AddField(bluge.NewKeywordField(documentFieldURL, url).StoreValue()).
			AddField(bluge.NewKeywordField(documentFieldLocation, location).Aggregatable().StoreValue()).
			AddField(bluge.NewTextField(documentFieldName, dashboard.info.Title).StoreValue().SearchTermPositions()).
			AddField(bluge.NewTextField(documentFieldDescription, dashboard.info.Description).SearchTermPositions())

		// Add legacy ID (for lookup by internal ID)
		doc.AddField(bluge.NewKeywordField(documentFieldInternalID, fmt.Sprintf("%d", dashboard.id)))

		for _, tag := range dashboard.info.Tags {
			doc.AddField(bluge.NewKeywordField(documentFieldTag, tag).
				StoreValue().
				Aggregatable().
				SearchTermPositions())
		}

		for _, ds := range dashboard.info.Datasource {
			if ds.UID != "" {
				doc.AddField(bluge.NewKeywordField(documentFieldDSUID, ds.UID).
					StoreValue().
					Aggregatable().
					SearchTermPositions())
			}
			if ds.Type != "" {
				doc.AddField(bluge.NewKeywordField(documentFieldDSType, ds.Type).
					StoreValue().
					Aggregatable().
					SearchTermPositions())
			}
		}

		// TODO: enterprise, add dashboard sorting fields

		batch.Insert(doc)

		location += "/" + dashboard.uid

		// Now add a doc for each panel
		for _, panel := range dashboard.info.Panels {
			uid := dashboard.uid + "#" + strconv.FormatInt(panel.ID, 10)
			purl := url
			if panel.Type != "row" {
				purl = fmt.Sprintf("%s?viewPanel=%d", url, panel.ID)
			}

			doc := bluge.NewDocument(uid).
				AddField(bluge.NewKeywordField(documentFieldURL, purl).StoreValue()).
				AddField(bluge.NewTextField(documentFieldName, panel.Title).StoreValue().SearchTermPositions()).
				AddField(bluge.NewTextField(documentFieldDescription, panel.Description).SearchTermPositions()).
				AddField(bluge.NewKeywordField(documentFieldPanelType, panel.Type).Aggregatable().StoreValue()).
				AddField(bluge.NewKeywordField(documentFieldLocation, location).Aggregatable().StoreValue()).
				AddField(bluge.NewKeywordField(documentFieldKind, string(entityKindPanel)).Aggregatable().StoreValue()) // likely want independent index for this

			batch.Insert(doc)
		}
	}

	logger.Info("Inserting documents into bluge batch", "elapsed", time.Since(label))
	label = time.Now()

	err = writer.Batch(batch)
	if err != nil {
		return nil, err
	}

	reader, err := writer.Reader()
	if err != nil {
		return nil, err
	}

	logger.Info("Inserting batch into bluge writer", "elapsed", time.Since(label))
	logger.Info("Finish building bluge index", "totalElapsed", time.Since(start))
	return reader, err
}

//nolint: gocyclo
func doBlugeQuery(ctx context.Context, s *StandardSearchService, reader *bluge.Reader, filter ResourceFilter, q DashboardQuery) *backend.DataResponse {
	response := &backend.DataResponse{}

	// Folder listing structure
	idx := strings.Index(q.Query, ":")
	if idx > 0 {
		key := q.Query[0:idx]
		val := q.Query[idx+1:]
		if key == "list" {
			q.Limit = 1000
			q.Query = ""
			q.Location = ""
			q.Explain = false
			q.SkipLocation = true
			q.Facet = nil
			if val == "root" || val == "" {
				q.Kind = []string{string(entityKindFolder)}
			} else {
				q.Location = val
				q.Kind = []string{string(entityKindDashboard)}
			}
		}
	}

	hasConstraints := false
	fullQuery := bluge.NewBooleanQuery()
	fullQuery.AddMust(newPermissionFilter(filter, s.logger))

	// Only show dashboard / folders
	if len(q.Kind) > 0 {
		bq := bluge.NewBooleanQuery()
		for _, k := range q.Kind {
			bq.AddShould(bluge.NewTermQuery(k).SetField(documentFieldKind))
		}
		fullQuery.AddMust(bq)
		hasConstraints = true
	}

	// Explicit UID lookup (stars etc)
	if len(q.UIDs) > 0 {
		bq := bluge.NewBooleanQuery()
		for _, v := range q.UIDs {
			bq.AddShould(bluge.NewTermQuery(v).SetField(documentFieldUID))
		}
		fullQuery.AddMust(bq)
		hasConstraints = true
	}

	// Legacy lookup by internal ID
	if len(q.IDs) > 0 {
		bq := bluge.NewBooleanQuery()
		for _, v := range q.IDs {
			bq.AddShould(bluge.NewTermQuery(fmt.Sprintf("%d", v)).SetField(documentFieldInternalID))
		}
		fullQuery.AddMust(bq)
		hasConstraints = true
	}

	// Tags
	if len(q.Tags) > 0 {
		bq := bluge.NewBooleanQuery()
		for _, v := range q.Tags {
			bq.AddMust(bluge.NewTermQuery(v).SetField(documentFieldTag))
		}
		fullQuery.AddMust(bq)
		hasConstraints = true
	}

	// Datasource
	if q.Datasource != "" {
		fullQuery.AddMust(bluge.NewTermQuery(q.Datasource).SetField(documentFieldDSUID))
		hasConstraints = true
	}

	// Folder
	if q.Location != "" {
		fullQuery.AddMust(bluge.NewTermQuery(q.Location).SetField(documentFieldLocation))
		hasConstraints = true
	}

	if q.Query == "*" || q.Query == "" {
		if !hasConstraints {
			fullQuery.AddShould(bluge.NewMatchAllQuery())
		}
	} else {
		// The actual se
		bq := bluge.NewBooleanQuery().
			AddShould(bluge.NewMatchPhraseQuery(q.Query).SetField("name").SetBoost(6)).
			AddShould(bluge.NewMatchPhraseQuery(q.Query).SetField("description").SetBoost(3)).
			AddShould(bluge.NewPrefixQuery(q.Query).SetField("name").SetBoost(1))

		if len(q.Query) > 4 {
			bq.AddShould(bluge.NewFuzzyQuery(q.Query).SetField("name")).SetBoost(1.5)
		}
		fullQuery.AddMust(bq)
	}

	limit := 50 // default view
	if q.Limit > 0 {
		limit = q.Limit
	}

	req := bluge.NewTopNSearch(limit, fullQuery)
	if q.From > 0 {
		req.SetFrom(q.From)
	}
	if q.Explain {
		req.ExplainScores()
	}
	req.WithStandardAggregations()

	// SortBy([]string{"-_score", "name"})
	//	req.SortBy([]string{documentFieldName})

	for _, t := range q.Facet {
		lim := t.Limit
		if lim < 1 {
			lim = 50
		}
		req.AddAggregation(t.Field, aggregations.NewTermsAggregation(search.Field(t.Field), lim))
	}

	// execute this search on the reader
	documentMatchIterator, err := reader.Search(ctx, req)
	if err != nil {
		s.logger.Error("error executing search: %v", err)
		response.Error = err
		return response
	}

	dvfieldNames := []string{"type"}
	sctx := search.NewSearchContext(0, 0)

	// numericFields := map[string]bool{"schemaVersion": true, "panelCount": true}

	fScore := data.NewFieldFromFieldType(data.FieldTypeFloat64, 0)
	fUID := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fKind := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fPType := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fName := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fURL := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fLocation := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fTags := data.NewFieldFromFieldType(data.FieldTypeNullableJSON, 0)
	fDSUIDs := data.NewFieldFromFieldType(data.FieldTypeNullableJSON, 0)
	fExplain := data.NewFieldFromFieldType(data.FieldTypeNullableJSON, 0)

	fScore.Name = "score"
	fUID.Name = "uid"
	fKind.Name = "kind"
	fName.Name = "name"
	fLocation.Name = "location"
	fURL.Name = "url"
	fURL.Config = &data.FieldConfig{
		Links: []data.DataLink{
			{Title: "link", URL: "${__value.text}"},
		},
	}
	fPType.Name = "panel_type"
	fDSUIDs.Name = "ds_uid"
	fTags.Name = "tags"
	fExplain.Name = "explain"

	frame := data.NewFrame("Query results", fScore, fKind, fUID, fName, fPType, fURL, fTags, fDSUIDs, fLocation)
	if q.Explain {
		frame.Fields = append(frame.Fields, fExplain)
	}

	locationItems := make(map[string]bool, 50)

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
		loc := ""
		var ds_uids []string
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
			case documentFieldUID:
				uid = string(value)
			case documentFieldKind:
				kind = string(value)
			case documentFieldPanelType:
				ptype = string(value)
			case documentFieldName:
				name = string(value)
			case documentFieldURL:
				url = string(value)
			case documentFieldLocation:
				loc = string(value)
			case documentFieldDSUID:
				ds_uids = append(ds_uids, string(value))
			case documentFieldTag:
				tags = append(tags, string(value))
			}
			return true
		})
		if err != nil {
			s.logger.Error("error loading stored fields: %v", err)
			response.Error = err
			return response
		}

		fScore.Append(match.Score)
		fKind.Append(kind)
		fUID.Append(uid)
		fPType.Append(ptype)
		fName.Append(name)
		fURL.Append(url)
		fLocation.Append(loc)

		// set a key for all path parts we return
		if !q.SkipLocation {
			for _, v := range strings.Split(loc, "/") {
				locationItems[v] = true
			}
		}

		if len(tags) > 0 {
			js, _ := json.Marshal(tags)
			jsb := json.RawMessage(js)
			fTags.Append(&jsb)
		} else {
			fTags.Append(nil)
		}

		if len(ds_uids) > 0 {
			js, _ := json.Marshal(ds_uids)
			jsb := json.RawMessage(js)
			fDSUIDs.Append(&jsb)
		} else {
			fDSUIDs.Append(nil)
		}

		if q.Explain {
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

	header := &customMeta{
		Count:    aggs.Count(), // Total cound
		MaxScore: aggs.Metric("max_score"),
	}
	if len(locationItems) > 0 && !q.SkipLocation {
		header.Locations = getLocationLookupInfo(ctx, reader, locationItems)
	}

	frame.SetMeta(&data.FrameMeta{
		Type:   "search-results",
		Custom: header,
	})

	response.Frames = append(response.Frames, frame)

	for _, t := range q.Facet {
		bbb := aggs.Buckets(t.Field)
		if bbb != nil {
			size := len(bbb)

			fName := data.NewFieldFromFieldType(data.FieldTypeString, size)
			fName.Name = t.Field

			fCount := data.NewFieldFromFieldType(data.FieldTypeUint64, size)
			fCount.Name = "Count"

			for i, v := range bbb {
				fName.Set(i, v.Name())
				fCount.Set(i, v.Count())
			}

			response.Frames = append(response.Frames, data.NewFrame("Facet: "+t.Field, fName, fCount))
		}
	}

	return response
}

func getLocationLookupInfo(ctx context.Context, reader *bluge.Reader, uids map[string]bool) map[string]locationItem {
	res := make(map[string]locationItem, len(uids))
	bq := bluge.NewBooleanQuery()
	for k := range uids {
		bq.AddShould(bluge.NewTermQuery(k).SetField(documentFieldUID))
	}

	req := bluge.NewAllMatches(bq)

	documentMatchIterator, err := reader.Search(ctx, req)
	if err != nil {
		return res
	}

	dvfieldNames := []string{"type"}
	sctx := search.NewSearchContext(0, 0)

	// execute this search on the reader
	// iterate through the document matches
	match, err := documentMatchIterator.Next()
	for err == nil && match != nil {
		err = match.LoadDocumentValues(sctx, dvfieldNames)
		if err != nil {
			continue
		}

		uid := ""
		item := locationItem{}

		_ = match.VisitStoredFields(func(field string, value []byte) bool {
			switch field {
			case documentFieldUID:
				uid = string(value)
			case documentFieldKind:
				item.Kind = string(value)
			case documentFieldName:
				item.Name = string(value)
			case documentFieldURL:
				item.URL = string(value)
			}
			return true
		})

		res[uid] = item

		// load the next document match
		match, err = documentMatchIterator.Next()
	}

	return res
}

type locationItem struct {
	Name string `json:"name"`
	Kind string `json:"kind"`
	URL  string `json:"url"`
}

type customMeta struct {
	Count     uint64                  `json:"count"`
	MaxScore  float64                 `json:"max_score,omitempty"`
	Locations map[string]locationItem `json:"locationInfo,omitempty"`
}
