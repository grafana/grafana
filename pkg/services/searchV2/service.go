package searchV2

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"

	"github.com/blugelabs/bluge"
	"github.com/blugelabs/bluge/search"
	"github.com/blugelabs/bluge/search/aggregations"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/searchV2/extract"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type StandardSearchService struct {
	registry.BackgroundService

	cfg  *setting.Cfg
	sql  *sqlstore.SQLStore
	auth FutureAuthService // eventually injected from elsewhere
	ac   accesscontrol.AccessControl

	logger         log.Logger
	dashboardIndex *dashboardIndex
}

func ProvideService(cfg *setting.Cfg, sql *sqlstore.SQLStore, entityEventStore store.EntityEventsService, ac accesscontrol.AccessControl) SearchService {
	return &StandardSearchService{
		cfg: cfg,
		sql: sql,
		ac:  ac,
		auth: &simpleSQLAuthService{
			sql: sql,
			ac:  ac,
		},
		dashboardIndex: newDashboardIndex(newSQLDashboardLoader(sql), entityEventStore),
		logger:         log.New("searchV2"),
	}
}

func (s *StandardSearchService) IsDisabled() bool {
	if s.cfg == nil {
		return true
	}
	return !s.cfg.IsFeatureToggleEnabled(featuremgmt.FlagPanelTitleSearch)
}

func (s *StandardSearchService) Run(ctx context.Context) error {
	return s.dashboardIndex.run(ctx)
}

func (s *StandardSearchService) getUser(ctx context.Context, backendUser *backend.User, orgId int64) (*models.SignedInUser, error) {
	// TODO: get user & user's permissions from the request context

	getSignedInUserQuery := &models.GetSignedInUserQuery{
		Login: backendUser.Login,
		Email: backendUser.Email,
		OrgId: orgId,
	}

	err := s.sql.GetSignedInUser(ctx, getSignedInUserQuery)
	if err != nil {
		s.logger.Error("Error while retrieving user", "error", err, "email", backendUser.Email)
		return nil, errors.New("auth error")
	}

	if getSignedInUserQuery.Result == nil {
		s.logger.Error("No user found", "email", backendUser.Email)
		return nil, errors.New("auth error")
	}

	user := getSignedInUserQuery.Result

	if s.ac.IsDisabled() {
		return user, nil
	}

	if user.Permissions == nil {
		user.Permissions = make(map[int64]map[string][]string)
	}

	if _, ok := user.Permissions[orgId]; ok {
		// permissions as part of the `s.sql.GetSignedInUser` query - return early
		return user, nil
	}

	// TODO: ensure this is cached
	permissions, err := s.ac.GetUserPermissions(ctx, user,
		accesscontrol.Options{ReloadCache: false})
	if err != nil {
		s.logger.Error("failed to retrieve user permissions", "error", err, "email", backendUser.Email)
		return nil, errors.New("auth error")
	}

	user.Permissions[orgId] = accesscontrol.GroupScopesByAction(permissions)
	return user, nil
}

func (s *StandardSearchService) DoDashboardQuery(ctx context.Context, user *backend.User, orgId int64, q DashboardQuery) *backend.DataResponse {
	reader := s.dashboardIndex.reader[orgId]
	if reader != nil && q.Query != "" { // frontend initalizes with empty string
		return s.doBlugeQuery(ctx, reader, orgId, q)
	}

	rsp := &backend.DataResponse{}

	dashboards, err := s.dashboardIndex.getDashboards(ctx, orgId)
	if err != nil {
		rsp.Error = err
		return rsp
	}

	signedInUser, err := s.getUser(ctx, user, orgId)
	if err != nil {
		rsp.Error = err
		return rsp
	}

	dashboards, err = s.applyAuthFilter(signedInUser, dashboards)
	if err != nil {
		rsp.Error = err
		return rsp
	}

	rsp.Frames = metaToFrame(dashboards)

	return rsp
}

func (s *StandardSearchService) applyAuthFilter(user *models.SignedInUser, dashboards []dashboard) ([]dashboard, error) {
	filter, err := s.auth.GetDashboardReadFilter(user)
	if err != nil {
		return nil, err
	}

	// create a list of all viewable dashboards for this user.
	res := make([]dashboard, 0, len(dashboards))
	for _, dash := range dashboards {
		if filter(dash.uid) || (dash.isFolder && dash.uid == "") { // include the "General" folder
			res = append(res, dash)
		}
	}
	return res, nil
}

func (s *StandardSearchService) doBlugeQuery(ctx context.Context, reader *bluge.Reader, orgId int64, q DashboardQuery) *backend.DataResponse {
	response := &backend.DataResponse{}

	var req bluge.SearchRequest
	if q.Query == "*" { // Match everything
		req = bluge.NewAllMatches(bluge.NewMatchAllQuery())
	} else {
		q := bluge.NewBooleanQuery().
			AddShould(bluge.NewMatchPhraseQuery(q.Query).SetField("name").SetBoost(6)).
			AddShould(bluge.NewMatchPhraseQuery(q.Query).SetField("description").SetBoost(3))

		tn := bluge.NewTopNSearch(100, q)
		tn.SortBy([]string{"-_score", "name"})
		req = tn

		s.logger.Info("RUN QUERY", "q", q)
	}

	termAggs := []string{"type", "_kind", "schemaVersion"}
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

	count := 0

	fHitNumber := data.NewFieldFromFieldType(data.FieldTypeInt32, 0)
	fScore := data.NewFieldFromFieldType(data.FieldTypeFloat64, 0)
	fKind := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fUID := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fPath := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fType := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fName := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fDescr := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fURL := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fTags := data.NewFieldFromFieldType(data.FieldTypeNullableJSON, 0)

	fHitNumber.Name = "Hit"
	fScore.Name = "Score"
	fKind.Name = "Kind"
	fUID.Name = "UID"
	fPath.Name = "Path"
	fType.Name = "Type"
	fName.Name = "Name"
	fDescr.Name = "Description"
	fURL.Name = "URL"
	fURL.Config = &data.FieldConfig{
		Links: []data.DataLink{
			{Title: "link", URL: "${__value.text}"},
		},
	}
	fTags.Name = "Tags"

	frame := data.NewFrame("Query results", fHitNumber, fScore, fKind, fUID, fPath, fType, fName, fDescr, fURL, fTags)

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
		descr := ""
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
			case "_kind":
				kind = string(value)
			case "type":
				ptype = string(value)
			case "name":
				name = string(value)
			case "description":
				descr = string(value)
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
		fDescr.Append(descr)
		fURL.Append(url)

		if len(tags) > 0 {
			js, _ := json.Marshal(tags)
			jsb := json.RawMessage(js)
			fTags.Append(&jsb)
		} else {
			fTags.Append(nil)
		}

		// load the next document match
		match, err = documentMatchIterator.Next()
	}

	// Must call after iterating :)
	aggs := documentMatchIterator.Aggregations()
	fmt.Printf("COUNT: %v (%d)\n", aggs.Count(), count)
	fmt.Printf("max_score: %v\n", aggs.Metric("max_score"))
	fmt.Printf("TIME: %v\n", aggs.Duration())
	fmt.Printf("NAME: %v\n", aggs.Name())

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

				if k == "schemaVersion" { // numeric
					// TODO, numeric column?
					sv, err := bluge.DecodeNumericFloat64([]byte(v.Name()))
					if err == nil {
						fName.Set(i, fmt.Sprintf("%d", int64(sv)))
					} else {
						fName.Set(i, v.Name())
					}
				} else {
					fName.Set(i, v.Name())
				}
			}

			response.Frames = append(response.Frames, data.NewFrame("Facet: "+k, fName, fCount))
		}
	}

	return response
}

type simpleCounter struct {
	values map[string]int64
}

func (c *simpleCounter) add(key string) {
	v, ok := c.values[key]
	if !ok {
		v = 0
	}
	c.values[key] = v + 1
}

func (c *simpleCounter) toFrame(name string) *data.Frame {
	key := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	val := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)
	for k, v := range c.values {
		key.Append(k)
		val.Append(v)
	}
	return data.NewFrame(name, key, val)
}

// UGLY... but helpful for now
func metaToFrame(meta []dashboard) data.Frames {
	folderID := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)
	folderUID := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	folderName := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	folderDashCount := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)

	folderID.Name = "id"
	folderUID.Name = "uid"
	folderName.Name = "name"
	folderDashCount.Name = "DashCount"

	dashID := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)
	dashUID := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	dashURL := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	dashFolderID := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)
	dashName := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	dashDescr := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	dashCreated := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
	dashUpdated := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
	dashSchemaVersion := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)
	dashTags := data.NewFieldFromFieldType(data.FieldTypeNullableString, 0)
	dashPanelCount := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)
	dashVarCount := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)
	dashDSList := data.NewFieldFromFieldType(data.FieldTypeNullableString, 0)

	dashID.Name = "id"
	dashUID.Name = "uid"
	dashFolderID.Name = "folderID"
	dashName.Name = "name"
	dashDescr.Name = "description"
	dashTags.Name = "tags"
	dashSchemaVersion.Name = "SchemaVersion"
	dashCreated.Name = "Created"
	dashUpdated.Name = "Updated"
	dashURL.Name = "url"
	dashURL.Config = &data.FieldConfig{
		Links: []data.DataLink{
			{Title: "link", URL: "${__value.text}"},
		},
	}
	dashPanelCount.Name = "panelCount"
	dashVarCount.Name = "varCount"
	dashDSList.Name = "datasource"

	dashTags.Config = &data.FieldConfig{
		Custom: map[string]interface{}{
			// Table panel default styling
			"displayMode": "json-view",
		},
	}

	panelDashID := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)
	panelID := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)
	panelName := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	panelDescr := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	panelType := data.NewFieldFromFieldType(data.FieldTypeString, 0)

	panelDashID.Name = "dashboardID"
	panelID.Name = "id"
	panelName.Name = "name"
	panelDescr.Name = "description"
	panelType.Name = "type"

	panelTypeCounter := simpleCounter{
		values: make(map[string]int64, 30),
	}

	schemaVersionCounter := simpleCounter{
		values: make(map[string]int64, 30),
	}

	folderCounter := make(map[int64]int64, 20)

	for _, row := range meta {
		if row.isFolder {
			folderID.Append(row.id)
			folderUID.Append(row.uid)
			folderName.Append(row.info.Title)
			folderDashCount.Append(int64(0)) // filled in later
			continue
		}

		dashID.Append(row.id)
		dashUID.Append(row.uid)
		dashFolderID.Append(row.folderID)
		dashName.Append(row.info.Title)
		dashDescr.Append(row.info.Title)
		dashSchemaVersion.Append(row.info.SchemaVersion)
		dashCreated.Append(row.created)
		dashUpdated.Append(row.updated)

		// Increment the folder counter
		fcount, ok := folderCounter[row.folderID]
		if !ok {
			fcount = 0
		}
		folderCounter[row.folderID] = fcount + 1

		url := fmt.Sprintf("/d/%s/%s", row.uid, row.slug)
		dashURL.Append(url)

		// stats
		schemaVersionCounter.add(strconv.FormatInt(row.info.SchemaVersion, 10))

		dashTags.Append(toJSONString(row.info.Tags))
		dashPanelCount.Append(int64(len(row.info.Panels)))
		dashVarCount.Append(int64(len(row.info.TemplateVars)))
		dashDSList.Append(dsAsJSONString(row.info.Datasource))

		// Row for each panel
		for _, panel := range row.info.Panels {
			panelDashID.Append(row.id)
			panelID.Append(panel.ID)
			panelName.Append(panel.Title)
			panelDescr.Append(panel.Description)
			panelType.Append(panel.Type)
			panelTypeCounter.add(panel.Type)
		}
	}

	// Update the folder counts
	for i := 0; i < folderID.Len(); i++ {
		id, ok := folderID.At(i).(int64)
		if ok {
			folderDashCount.Set(i, folderCounter[id])
		}
	}

	return data.Frames{
		data.NewFrame("folders", folderID, folderUID, folderName, folderDashCount),
		data.NewFrame("dashboards", dashID, dashUID, dashURL, dashFolderID,
			dashName, dashDescr, dashTags,
			dashSchemaVersion,
			dashPanelCount, dashVarCount, dashDSList,
			dashCreated, dashUpdated),
		data.NewFrame("panels", panelDashID, panelID, panelName, panelDescr, panelType),
		panelTypeCounter.toFrame("panel-type-counts"),
		schemaVersionCounter.toFrame("schema-version-counts"),
	}
}

func toJSONString(vals []string) *string {
	if len(vals) < 1 {
		return nil
	}
	b, err := json.Marshal(vals)
	if err == nil {
		s := string(b)
		return &s
	}
	return nil
}

func dsAsJSONString(vals []extract.DataSourceRef) *string {
	if len(vals) < 1 {
		return nil
	}
	b, err := json.Marshal(vals)
	if err == nil {
		s := string(b)
		return &s
	}
	return nil
}
