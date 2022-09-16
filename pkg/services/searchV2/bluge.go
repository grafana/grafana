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
	documentFieldName_sort   = "name_sort"
	documentFieldName_ngram  = "name_ngram"
	documentFieldLocation    = "location" // parent path
	documentFieldPanelType   = "panel_type"
	documentFieldTransformer = "transformer"
	documentFieldDSUID       = "ds_uid"
	documentFieldDSType      = "ds_type"
	DocumentFieldCreatedAt   = "created_at"
	DocumentFieldUpdatedAt   = "updated_at"
)

func initOrgIndex(dashboards []dashboard, logger log.Logger, extendDoc ExtendDashboardFunc) (*orgIndex, error) {
	dashboardWriter, err := bluge.OpenWriter(bluge.InMemoryOnlyConfig())
	if err != nil {
		return nil, fmt.Errorf("error opening writer: %v", err)
	}
	// Not closing Writer here since we use it later while processing dashboard change events.

	start := time.Now()
	label := start

	batch := bluge.NewBatch()

	// In order to reduce memory usage while initial indexing we are limiting
	// the size of batch here.
	docsInBatch := 0
	maxBatchSize := 100

	flushIfRequired := func(force bool) error {
		docsInBatch++
		needFlush := force || (maxBatchSize > 0 && docsInBatch >= maxBatchSize)
		if !needFlush {
			return nil
		}
		err := dashboardWriter.Batch(batch)
		if err != nil {
			return err
		}
		docsInBatch = 0
		batch.Reset()
		return nil
	}

	// First index the folders to construct folderIdLookup.
	folderIdLookup := make(map[int64]string, 50)
	for _, dash := range dashboards {
		if !dash.isFolder {
			continue
		}
		doc := getFolderDashboardDoc(dash)
		if err := extendDoc(dash.uid, doc); err != nil {
			return nil, err
		}
		batch.Insert(doc)
		if err := flushIfRequired(false); err != nil {
			return nil, err
		}
		uid := dash.uid
		if uid == "" {
			uid = "general"
		}
		folderIdLookup[dash.id] = uid
	}

	// Then each dashboard.
	for _, dash := range dashboards {
		if dash.isFolder {
			continue
		}
		folderUID := folderIdLookup[dash.folderID]
		location := folderUID
		doc := getNonFolderDashboardDoc(dash, location)
		if err := extendDoc(dash.uid, doc); err != nil {
			return nil, err
		}
		batch.Insert(doc)
		if err := flushIfRequired(false); err != nil {
			return nil, err
		}

		// Index each panel in dashboard.
		if location != "" {
			location += "/"
		}
		location += dash.uid
		docs := getDashboardPanelDocs(dash, location)

		for _, panelDoc := range docs {
			batch.Insert(panelDoc)
			if err := flushIfRequired(false); err != nil {
				return nil, err
			}
		}
	}

	// Flush docs in batch with force as we are in the end.
	if err := flushIfRequired(true); err != nil {
		return nil, err
	}

	logger.Info("Finish inserting docs into index", "elapsed", time.Since(label))
	logger.Info("Finish building index", "totalElapsed", time.Since(start))
	return &orgIndex{
		writers: map[indexType]*bluge.Writer{
			indexTypeDashboard: dashboardWriter,
		},
	}, err
}

func getFolderDashboardDoc(dash dashboard) *bluge.Document {
	uid := dash.uid
	url := fmt.Sprintf("/dashboards/f/%s/%s", dash.uid, dash.slug)
	if uid == "" {
		uid = "general"
		url = "/dashboards"
		dash.info.Title = "General"
		dash.info.Description = ""
	}

	return newSearchDocument(uid, dash.info.Title, dash.info.Description, url).
		AddField(bluge.NewKeywordField(documentFieldKind, string(entityKindFolder)).Aggregatable().StoreValue()).
		AddField(bluge.NewDateTimeField(DocumentFieldCreatedAt, dash.created).Sortable().StoreValue()).
		AddField(bluge.NewDateTimeField(DocumentFieldUpdatedAt, dash.updated).Sortable().StoreValue())
}

func getNonFolderDashboardDoc(dash dashboard, location string) *bluge.Document {
	url := fmt.Sprintf("/d/%s/%s", dash.uid, dash.slug)

	// Dashboard document
	doc := newSearchDocument(dash.uid, dash.info.Title, dash.info.Description, url).
		AddField(bluge.NewKeywordField(documentFieldKind, string(entityKindDashboard)).Aggregatable().StoreValue()).
		AddField(bluge.NewKeywordField(documentFieldLocation, location).Aggregatable().StoreValue()).
		AddField(bluge.NewDateTimeField(DocumentFieldCreatedAt, dash.created).Sortable().StoreValue()).
		AddField(bluge.NewDateTimeField(DocumentFieldUpdatedAt, dash.updated).Sortable().StoreValue())

	for _, tag := range dash.info.Tags {
		doc.AddField(bluge.NewKeywordField(documentFieldTag, tag).
			StoreValue().
			Aggregatable().
			SearchTermPositions())
	}

	for _, ds := range dash.info.Datasource {
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

	return doc
}

func getDashboardPanelDocs(dash dashboard, location string) []*bluge.Document {
	var docs []*bluge.Document
	url := fmt.Sprintf("/d/%s/%s", dash.uid, dash.slug)
	for _, panel := range dash.info.Panels {
		if panel.Type == "row" {
			continue // for now, we are excluding rows from the search index
		}

		uid := dash.uid + "#" + strconv.FormatInt(panel.ID, 10)
		purl := fmt.Sprintf("%s?viewPanel=%d", url, panel.ID)

		doc := newSearchDocument(uid, panel.Title, panel.Description, purl).
			AddField(bluge.NewKeywordField(documentFieldPanelType, panel.Type).Aggregatable().StoreValue()).
			AddField(bluge.NewKeywordField(documentFieldLocation, location).Aggregatable().StoreValue()).
			AddField(bluge.NewKeywordField(documentFieldKind, string(entityKindPanel)).Aggregatable().StoreValue()) // likely want independent index for this

		for _, xform := range panel.Transformer {
			doc.AddField(bluge.NewKeywordField(documentFieldTransformer, xform).Aggregatable())
		}

		for _, ds := range panel.Datasource {
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

		docs = append(docs, doc)
	}
	return docs
}

// Names need to be indexed a few ways to support key features
func newSearchDocument(uid string, name string, descr string, url string) *bluge.Document {
	doc := bluge.NewDocument(uid)

	if name != "" {
		doc.AddField(bluge.NewTextField(documentFieldName, name).StoreValue().SearchTermPositions())
		doc.AddField(bluge.NewTextField(documentFieldName_ngram, name).WithAnalyzer(ngramIndexAnalyzer))

		// Don't add a field for empty names
		sortStr := formatForNameSortField(name)
		if len(sortStr) > 0 {
			doc.AddField(bluge.NewKeywordField(documentFieldName_sort, sortStr).Sortable())
		}
	}
	if url != "" {
		doc.AddField(bluge.NewKeywordField(documentFieldURL, url).StoreValue())
	}
	return doc
}

func getDashboardPanelIDs(index *orgIndex, panelLocation string) ([]string, error) {
	var panelIDs []string

	reader, cancel, err := index.readerForIndex(indexTypeDashboard)
	if err != nil {
		return nil, err
	}
	defer cancel()

	fullQuery := bluge.NewBooleanQuery()
	fullQuery.AddMust(bluge.NewTermQuery(panelLocation).SetField(documentFieldLocation))
	fullQuery.AddMust(bluge.NewTermQuery(string(entityKindPanel)).SetField(documentFieldKind))
	req := bluge.NewAllMatches(fullQuery)
	documentMatchIterator, err := reader.Search(context.Background(), req)
	if err != nil {
		return nil, err
	}
	match, err := documentMatchIterator.Next()
	for err == nil && match != nil {
		// load the identifier for this match
		err = match.VisitStoredFields(func(field string, value []byte) bool {
			if field == documentFieldUID {
				panelIDs = append(panelIDs, string(value))
			}
			return true
		})
		if err != nil {
			return nil, err
		}
		// load the next document match
		match, err = documentMatchIterator.Next()
	}
	return panelIDs, err
}

func getDocsIDsByLocationPrefix(index *orgIndex, prefix string) ([]string, error) {
	var ids []string

	reader, cancel, err := index.readerForIndex(indexTypeDashboard)
	if err != nil {
		return nil, fmt.Errorf("error getting reader: %w", err)
	}
	defer cancel()

	fullQuery := bluge.NewBooleanQuery()
	fullQuery.AddMust(bluge.NewPrefixQuery(prefix).SetField(documentFieldLocation))
	req := bluge.NewAllMatches(fullQuery)
	documentMatchIterator, err := reader.Search(context.Background(), req)
	if err != nil {
		return nil, fmt.Errorf("error search: %w", err)
	}
	match, err := documentMatchIterator.Next()
	for err == nil && match != nil {
		// load the identifier for this match
		err = match.VisitStoredFields(func(field string, value []byte) bool {
			if field == documentFieldUID {
				ids = append(ids, string(value))
			}
			return true
		})
		if err != nil {
			return nil, err
		}
		// load the next document match
		match, err = documentMatchIterator.Next()
	}
	return ids, err
}

func getDashboardLocation(index *orgIndex, dashboardUID string) (string, bool, error) {
	var dashboardLocation string
	var found bool

	reader, cancel, err := index.readerForIndex(indexTypeDashboard)
	if err != nil {
		return "", false, err
	}
	defer cancel()

	fullQuery := bluge.NewBooleanQuery()
	fullQuery.AddMust(bluge.NewTermQuery(dashboardUID).SetField(documentFieldUID))
	fullQuery.AddMust(bluge.NewTermQuery(string(entityKindDashboard)).SetField(documentFieldKind))
	req := bluge.NewAllMatches(fullQuery)
	documentMatchIterator, err := reader.Search(context.Background(), req)
	if err != nil {
		return "", false, err
	}
	match, err := documentMatchIterator.Next()
	for err == nil && match != nil {
		// load the identifier for this match
		err = match.VisitStoredFields(func(field string, value []byte) bool {
			if field == documentFieldLocation {
				dashboardLocation = string(value)
				found = true
				return false
			}
			return true
		})
		if err != nil {
			return "", false, err
		}
		// load the next document match
		match, err = documentMatchIterator.Next()
	}
	return dashboardLocation, found, err
}

//nolint:gocyclo
func doSearchQuery(
	ctx context.Context,
	logger log.Logger,
	index *orgIndex,
	filter ResourceFilter,
	q DashboardQuery,
	extender QueryExtender,
	appSubUrl string,
) *backend.DataResponse {
	response := &backend.DataResponse{}
	header := &customMeta{}

	reader, cancel, err := index.readerForIndex(indexTypeDashboard)
	if err != nil {
		logger.Error("error getting reader for dashboard index: %v", err)
		response.Error = err
		return response
	}
	defer cancel()

	hasConstraints := false
	fullQuery := bluge.NewBooleanQuery()
	fullQuery.AddMust(newPermissionFilter(filter, logger))

	// Only show dashboard / folders / panels.
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
		count := len(q.UIDs) + 3
		bq := bluge.NewBooleanQuery()
		for i, v := range q.UIDs {
			bq.AddShould(bluge.NewTermQuery(v).
				SetField(documentFieldUID).
				SetBoost(float64(count - i)))
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

	// Panel type
	if q.PanelType != "" {
		fullQuery.AddMust(bluge.NewTermQuery(q.PanelType).SetField(documentFieldPanelType))
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

	isMatchAllQuery := q.Query == "*" || q.Query == ""
	if isMatchAllQuery {
		if !hasConstraints {
			fullQuery.AddShould(bluge.NewMatchAllQuery())
		}
	} else {
		bq := bluge.NewBooleanQuery()

		bq.AddShould(NewSubstringQuery(formatForNameSortField(q.Query)).
			SetField(documentFieldName_sort).
			SetBoost(6))

		if shouldUseNgram(q) {
			bq.AddShould(bluge.NewMatchQuery(q.Query).
				SetField(documentFieldName_ngram).
				SetOperator(bluge.MatchQueryOperatorAnd). // all terms must match
				SetAnalyzer(ngramQueryAnalyzer).SetBoost(1))
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

	if q.Sort != "" {
		req.SortBy([]string{q.Sort})
		header.SortBy = strings.TrimPrefix(q.Sort, "-")
	}

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
		logger.Error("error executing search", "err", err)
		response.Error = err
		return response
	}

	fScore := data.NewFieldFromFieldType(data.FieldTypeFloat64, 0)
	fUID := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fKind := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fPType := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fName := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fURL := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fLocation := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fTags := data.NewFieldFromFieldType(data.FieldTypeNullableJSON, 0)
	fDSUIDs := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
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

	frame := data.NewFrame("Query results", fKind, fUID, fName, fPType, fURL, fTags, fDSUIDs, fLocation)
	if q.Explain {
		frame.Fields = append(frame.Fields, fScore, fExplain)
	}
	frame.SetMeta(&data.FrameMeta{
		Type:   "search-results",
		Custom: header,
	})

	fieldLen := 0
	ext := extender.GetFramer(frame)

	locationItems := make(map[string]bool, 50)

	// iterate through the document matches
	match, err := documentMatchIterator.Next()
	for err == nil && match != nil {
		uid := ""
		kind := ""
		ptype := ""
		name := ""
		url := ""
		loc := ""
		var dsUIDs []string
		var tags []string

		err = match.VisitStoredFields(func(field string, value []byte) bool {
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
				url = appSubUrl + string(value)
			case documentFieldLocation:
				loc = string(value)
			case documentFieldDSUID:
				dsUIDs = append(dsUIDs, string(value))
			case documentFieldTag:
				tags = append(tags, string(value))
			default:
				ext(field, value)
			}
			return true
		})
		if err != nil {
			logger.Error("error loading stored fields", "err", err)
			response.Error = err
			return response
		}

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

		if len(dsUIDs) == 0 {
			dsUIDs = []string{}
		}

		js, _ := json.Marshal(dsUIDs)
		jsb := json.RawMessage(js)
		fDSUIDs.Append(jsb)

		if q.Explain {
			if isMatchAllQuery {
				fScore.Append(float64(fieldLen + q.From))
			} else {
				fScore.Append(match.Score)
			}
			if match.Explanation != nil {
				js, _ := json.Marshal(&match.Explanation)
				jsb := json.RawMessage(js)
				fExplain.Append(&jsb)
			} else {
				fExplain.Append(nil)
			}
		}

		// extend fields to match the longest field
		fieldLen++
		for _, f := range frame.Fields {
			if fieldLen > f.Len() {
				f.Extend(fieldLen - f.Len())
			}
		}

		// load the next document match
		match, err = documentMatchIterator.Next()
	}

	// Must call after iterating :)
	aggs := documentMatchIterator.Aggregations()

	header.Count = aggs.Count() // Total count
	if q.Explain {
		header.MaxScore = aggs.Metric("max_score")
	}

	if len(locationItems) > 0 && !q.SkipLocation {
		header.Locations = getLocationLookupInfo(ctx, reader, locationItems)
	}

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

func shouldUseNgram(q DashboardQuery) bool {
	var tokens []string
	if len(q.Query) > ngramEdgeFilterMaxLength {
		tokens = strings.Fields(q.Query)
		for _, k := range tokens {
			// ngram will never match if at least one input token exceeds the max token length,
			// as all tokens must match simultaneously with the `bluge.MatchQueryOperatorAnd` operator
			if len(k) > ngramEdgeFilterMaxLength {
				return false
			}
		}
	}
	return true
}

func formatForNameSortField(name string) string {
	return strings.Trim(strings.ToUpper(name), " ")
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
	SortBy    string                  `json:"sortBy,omitempty"`
}
