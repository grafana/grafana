package searchV2

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
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

	logger         log.Logger
	dashboardIndex *dashboardIndex
}

func ProvideService(cfg *setting.Cfg, sql *sqlstore.SQLStore, entityEventStore store.EntityEventsService) SearchService {
	return &StandardSearchService{
		cfg: cfg,
		sql: sql,
		auth: &simpleSQLAuthService{
			sql: sql,
		},
		dashboardIndex: newDashboardIndex(&sqlDashboardLoader{sql: sql}, entityEventStore),
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

func (s *StandardSearchService) DoDashboardQuery(ctx context.Context, user *backend.User, orgId int64, _ DashboardQuery) *backend.DataResponse {
	rsp := &backend.DataResponse{}

	dash, err := s.dashboardIndex.getDashboards(ctx, orgId)
	if err != nil {
		rsp.Error = err
		return rsp
	}

	// TODO - get user from context?
	getSignedInUserQuery := &models.GetSignedInUserQuery{
		Login: user.Login,
		Email: user.Email,
		OrgId: orgId,
	}

	err = s.sql.GetSignedInUser(ctx, getSignedInUserQuery)
	if err != nil {
		s.logger.Error("Error while retrieving user", "error", err)
		rsp.Error = fmt.Errorf("auth error")
		return rsp
	}

	if getSignedInUserQuery.Result == nil {
		s.logger.Error("No user found", "email", user.Email)
		rsp.Error = fmt.Errorf("auth error")
		return rsp
	}

	dash, err = s.applyAuthFilter(getSignedInUserQuery.Result, dash)
	if err != nil {
		rsp.Error = err
		return rsp
	}

	rsp.Frames = metaToFrame(dash)

	return rsp
}

func (s *StandardSearchService) applyAuthFilter(user *models.SignedInUser, dash []dashboard) ([]dashboard, error) {
	filter, err := s.auth.GetDashboardReadFilter(user)
	if err != nil {
		return nil, err
	}

	// create a list of all viewable dashboards for this user
	res := make([]dashboard, 0, len(dash))
	for _, dash := range dash {
		if filter(dash.info.UID) || (dash.isFolder && dash.info.UID == "") { // include the "General" folder
			res = append(res, dash)
		}
	}
	return res, nil
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
			folderUID.Append(row.info.UID)
			folderName.Append(row.info.Title)
			folderDashCount.Append(int64(0)) // filled in later
			continue
		}

		dashID.Append(row.id)
		dashUID.Append(row.info.UID)
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

		url := fmt.Sprintf("/d/%s/%s", row.info.UID, row.slug)
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
