package migrations

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"github.com/bwmarrin/snowflake"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util/xorm"
)

func initResourceTables(mg *migrator.Migrator) string {
	marker := "Initialize resource tables"
	mg.AddMigration(marker, &migrator.RawSQLMigration{})

	resource_table := migrator.Table{
		Name: "resource",
		Columns: []*migrator.Column{
			// primary identifier
			{Name: "guid", Type: migrator.DB_NVarchar, Length: 36, Nullable: false, IsPrimaryKey: true},

			{Name: "resource_version", Type: migrator.DB_BigInt, Nullable: true},

			// K8s Identity group+(version)+namespace+resource+name
			{Name: "group", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "resource", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 63, Nullable: false},
			{Name: "name", Type: migrator.DB_NVarchar, Length: 253, Nullable: false},
			{Name: "value", Type: migrator.DB_LongText, Nullable: true},
			{Name: "action", Type: migrator.DB_Int, Nullable: false}, // 1: create, 2: update, 3: delete

			// Hashed label set
			{Name: "label_set", Type: migrator.DB_NVarchar, Length: 64, Nullable: true}, // null is no labels
		},
		Indices: []*migrator.Index{
			{Cols: []string{"namespace", "group", "resource", "name"}, Type: migrator.UniqueIndex},
		},
	}
	resource_history_table := migrator.Table{
		Name: "resource_history",
		Columns: []*migrator.Column{
			// primary identifier
			{Name: "guid", Type: migrator.DB_NVarchar, Length: 36, Nullable: false, IsPrimaryKey: true},
			{Name: "resource_version", Type: migrator.DB_BigInt, Nullable: true},

			// K8s Identity group+(version)+namespace+resource+name
			{Name: "group", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "resource", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 63, Nullable: false},
			{Name: "name", Type: migrator.DB_NVarchar, Length: 253, Nullable: false},
			{Name: "value", Type: migrator.DB_LongText, Nullable: true},
			{Name: "action", Type: migrator.DB_Int, Nullable: false}, // 1: create, 2: update, 3: delete

			// Hashed label set
			{Name: "label_set", Type: migrator.DB_NVarchar, Length: 64, Nullable: true}, // null is no labels
		},
		Indices: []*migrator.Index{
			{
				Cols: []string{"namespace", "group", "resource", "name", "resource_version"},
				Type: migrator.UniqueIndex,
				Name: "UQE_resource_history_namespace_group_name_version",
			},
			// index to support watch poller
			{Cols: []string{"resource_version"}, Type: migrator.IndexType},
		},
	}

	tables := []migrator.Table{resource_table, resource_history_table}

	// tables = append(tables, migrator.Table{
	// 	Name: "resource_label_set",
	// 	Columns: []*migrator.Column{
	// 		{Name: "label_set", Type: migrator.DB_NVarchar, Length: 64, Nullable: false},
	// 		{Name: "label", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
	// 		{Name: "value", Type: migrator.DB_Text, Nullable: false},
	// 	},
	// 	Indices: []*migrator.Index{
	// 		{Cols: []string{"label_set", "label"}, Type: migrator.UniqueIndex},
	// 	},
	// })

	tables = append(tables, migrator.Table{
		Name: "resource_version",
		Columns: []*migrator.Column{
			{Name: "group", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "resource", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "resource_version", Type: migrator.DB_BigInt, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"group", "resource"}, Type: migrator.UniqueIndex},
		},
	})

	tables = append(tables, migrator.Table{
		Name: "resource_blob",
		Columns: []*migrator.Column{
			{Name: "uuid", Type: migrator.DB_Uuid, Length: 36, Nullable: false, IsPrimaryKey: true},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},

			{Name: "group", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "resource", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 63, Nullable: false},
			{Name: "name", Type: migrator.DB_NVarchar, Length: 253, Nullable: false},

			// The raw bytes
			{Name: "value", Type: migrator.DB_LongBlob, Nullable: false},

			// Used as an etag
			{Name: "hash", Type: migrator.DB_NVarchar, Length: 64, Nullable: false},
			{Name: "content_type", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
		},
		Indices: []*migrator.Index{
			{
				Cols: []string{"namespace", "group", "resource", "name"},
				Type: migrator.IndexType,
				Name: "IDX_resource_history_namespace_group_name",
			},
			{Cols: []string{"created"}, Type: migrator.IndexType}, // sort field
		},
	})

	resource_last_import_time := migrator.Table{
		Name: "resource_last_import_time",
		Columns: []*migrator.Column{
			{Name: "group", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "resource", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 63, Nullable: false},
			{Name: "last_import_time", Type: migrator.DB_DateTime, Nullable: false},
		},
		PrimaryKeys: []string{"group", "resource", "namespace"},
	}
	tables = append(tables, resource_last_import_time)

	// Initialize all tables
	for t := range tables {
		mg.AddMigration("drop table "+tables[t].Name, migrator.NewDropTableMigration(tables[t].Name))
		mg.AddMigration("create table "+tables[t].Name, migrator.NewAddTableMigration(tables[t]))
		for i := range tables[t].Indices {
			mg.AddMigration(fmt.Sprintf("create table %s, index: %d", tables[t].Name, i), migrator.NewAddIndexMigration(tables[t], tables[t].Indices[i]))
		}
	}

	mg.AddMigration("Add column previous_resource_version in resource_history", migrator.NewAddColumnMigration(resource_history_table, &migrator.Column{
		Name: "previous_resource_version", Type: migrator.DB_BigInt, Nullable: true,
	}))

	mg.AddMigration("Add column previous_resource_version in resource", migrator.NewAddColumnMigration(resource_table, &migrator.Column{
		Name: "previous_resource_version", Type: migrator.DB_BigInt, Nullable: true,
	}))

	mg.AddMigration("Add index to resource_history for polling", migrator.NewAddIndexMigration(resource_history_table, &migrator.Index{
		Cols: []string{"group", "resource", "resource_version"}, Type: migrator.IndexType,
	}))

	mg.AddMigration("Add index to resource for loading", migrator.NewAddIndexMigration(resource_table, &migrator.Index{
		Cols: []string{"group", "resource"}, Type: migrator.IndexType,
	}))

	mg.AddMigration("Add column folder in resource_history", migrator.NewAddColumnMigration(resource_history_table, &migrator.Column{
		Name: "folder", Type: migrator.DB_NVarchar, Length: 253, Nullable: false, Default: "''",
	}))

	mg.AddMigration("Add column folder in resource", migrator.NewAddColumnMigration(resource_table, &migrator.Column{
		Name: "folder", Type: migrator.DB_NVarchar, Length: 253, Nullable: false, Default: "''",
	}))

	mg.AddMigration("Migrate DeletionMarkers to real Resource objects", &deletionMarkerMigrator{})

	mg.AddMigration("Add index to resource_history for get trash", migrator.NewAddIndexMigration(resource_history_table, &migrator.Index{
		Name: "IDX_resource_history_namespace_group_resource_action_version",
		Cols: []string{"namespace", "group", "resource", "action", "resource_version"},
		Type: migrator.IndexType,
	}))

	// Add generation column so we can use it for more aggressive pruning
	mg.AddMigration("Add generation to resource history", migrator.NewAddColumnMigration(resource_history_table, &migrator.Column{
		Name: "generation", Type: migrator.DB_BigInt, Nullable: false, Default: "0",
	}))
	mg.AddMigration("Add generation index to resource history", migrator.NewAddIndexMigration(resource_history_table, &migrator.Index{
		Cols: []string{"namespace", "group", "resource", "name", "generation"},
		Type: migrator.IndexType,
		Name: "IDX_resource_history_namespace_group_resource_name_generation",
	}))

	mg.AddMigration("Add UQE_resource_last_import_time_last_import_time index", migrator.NewAddIndexMigration(resource_last_import_time, &migrator.Index{
		Cols: []string{"last_import_time"},
		Type: migrator.IndexType,
		Name: "UQE_resource_last_import_time_last_import_time",
	}))

	mg.AddMigration("Add key_path column to resource_history", migrator.NewAddColumnMigration(resource_history_table, &migrator.Column{
		Name: "key_path", Type: migrator.DB_NVarchar, Length: 2048, Nullable: false, Default: "''", IsLatin: true,
	}))

	resource_events_table := migrator.Table{
		Name: "resource_events",
		Columns: []*migrator.Column{
			{Name: "key_path", Type: migrator.DB_NVarchar, Length: 2048, Nullable: false, IsPrimaryKey: true, IsLatin: true},
			{Name: "value", Type: migrator.DB_MediumText, Nullable: false},
		},
	}
	mg.AddMigration("create table "+resource_events_table.Name, migrator.NewAddTableMigration(resource_events_table))

	mg.AddMigration("Add IDX_resource_history_key_path index", migrator.NewAddIndexMigration(resource_history_table, &migrator.Index{
		Cols: []string{"key_path"},
		Type: migrator.IndexType,
		Name: "IDX_resource_history_key_path",
	}))

	oldResourceVersionUniqueKey := migrator.Index{Cols: []string{"group", "resource"}, Type: migrator.UniqueIndex}
	updatedResourceVersionTable := migrator.Table{
		Name: "resource_version",
		Columns: []*migrator.Column{
			{Name: "group", Type: migrator.DB_NVarchar, Length: 190, Nullable: false, IsPrimaryKey: true},
			{Name: "resource", Type: migrator.DB_NVarchar, Length: 190, Nullable: false, IsPrimaryKey: true},
			{Name: "resource_version", Type: migrator.DB_BigInt, Nullable: false},
		},
		PrimaryKeys: []string{"group", "resource"},
	}

	migrator.ConvertUniqueKeyToPrimaryKey(mg, oldResourceVersionUniqueKey, updatedResourceVersionTable)

	mg.AddMigration("Change key_path collation of resource_history in postgres", migrator.NewRawSQLMigration("").Postgres(`ALTER TABLE resource_history ALTER COLUMN key_path TYPE VARCHAR(2048) COLLATE "C";`))
	mg.AddMigration("Change key_path collation of resource_events in postgres", migrator.NewRawSQLMigration("").Postgres(`ALTER TABLE resource_events ALTER COLUMN key_path TYPE VARCHAR(2048) COLLATE "C";`))

	mg.AddMigration("resource_history key_path backfill", &ResourceHistoryKeyPathBackfillMigration{})

	mg.AddMigration("Add index to resource_history for garbage collection", migrator.NewAddIndexMigration(resource_history_table, &migrator.Index{
		Cols: []string{"group", "resource", "action", "resource_version", "name"},
		Type: migrator.IndexType,
		Name: "IDX_resource_history_resource_action_version_name",
	}))

	mg.AddMigration("Fix resource dashboard variable quotes in PostgreSQL panels", &FixResourceDashboardVariableQuotesMigration{})

	return marker
}

type ResourceHistoryKeyPathBackfillMigration struct {
	migrator.MigrationBase
}

func (m *ResourceHistoryKeyPathBackfillMigration) SQL(_ migrator.Dialect) string {
	return "resource_history key_path backfill code migration"
}

func (m *ResourceHistoryKeyPathBackfillMigration) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	rows, err := getResourceHistoryRows(sess, mg, resourceHistoryRow{})
	if err != nil {
		return err
	}

	for len(rows) > 0 {
		if err := updateResourceHistoryKeyPath(sess, rows); err != nil {
			return err
		}

		rows, err = getResourceHistoryRows(sess, mg, rows[len(rows)-1])
		if err != nil {
			return err
		}
	}

	return nil
}

func updateResourceHistoryKeyPath(sess *xorm.Session, rows []resourceHistoryRow) error {
	if len(rows) == 0 {
		return nil
	}

	updates := []resourceHistoryRow{}

	for _, row := range rows {
		if row.KeyPath == "" {
			row.KeyPath = parseKeyPath(row)
			updates = append(updates, row)
		}
	}

	if len(updates) == 0 {
		return nil
	}

	guids := ""
	setCases := "CASE"
	for _, row := range updates {
		guids += fmt.Sprintf("'%s',", row.GUID)
		setCases += fmt.Sprintf(" WHEN guid = '%s' THEN '%s'", row.GUID, row.KeyPath)
	}

	guids = strings.TrimRight(guids, ",")
	setCases += " ELSE key_path END "

	// the query will look like this
	// UPDATE resource_history
	// SET key_path = CASE
	//   WHEN guid = '1402de51-669b-4206-8a6c-005a00eee6e3' then 'unified/data/folder.grafana.app/folders/default/cf6lylpvls000c/1998492888241012800~created~'
	//   WHEN guid = '8842cc56-f22b-45e1-82b1-99759cd443b3' then 'unified/data/dashboard.grafana.app/dashboards/default/adzvfhp/1998492902577144677~created~cf6lylpvls000c'
	//   ELSE key_path END
	// WHERE guid IN ('1402de51-669b-4206-8a6c-005a00eee6e3', '8842cc56-f22b-45e1-82b1-99759cd443b3')
	// AND key_path = '';
	sql := fmt.Sprintf(`
	UPDATE resource_history
	SET key_path = %s
	WHERE guid IN (%s)
	AND key_path = '';
	`, setCases, guids)

	if _, err := sess.Exec(sql); err != nil {
		return err
	}

	return nil
}

func parseKeyPath(row resourceHistoryRow) string {
	var action string
	switch row.Action {
	case 1:
		action = "created"
	case 2:
		action = "updated"
	case 3:
		action = "deleted"
	}
	return fmt.Sprintf("unified/data/%s/%s/%s/%s/%d~%s~%s", row.Group, row.Resource, row.Namespace, row.Name, snowflakeFromRv(row.ResourceVersion), action, row.Folder)
}

func snowflakeFromRv(rv int64) int64 {
	return (((rv / 1000) - snowflake.Epoch) << (snowflake.NodeBits + snowflake.StepBits)) + (rv % 1000)
}

type resourceHistoryRow struct {
	GUID            string `xorm:"guid"`
	Group           string `xorm:"group"`
	Resource        string `xorm:"resource"`
	Namespace       string `xorm:"namespace"`
	Name            string `xorm:"name"`
	ResourceVersion int64  `xorm:"resource_version"`
	Action          int64  `xorm:"action"`
	Folder          string `xorm:"folder"`
	KeyPath         string `xorm:"key_path"`
}

func getResourceHistoryRows(sess *xorm.Session, mg *migrator.Migrator, continueRow resourceHistoryRow) ([]resourceHistoryRow, error) {
	var rows []resourceHistoryRow
	cols := fmt.Sprintf(
		"%s, %s, %s, %s, %s, %s, %s, %s, %s",
		mg.Dialect.Quote("guid"),
		mg.Dialect.Quote("group"),
		mg.Dialect.Quote("resource"),
		mg.Dialect.Quote("namespace"),
		mg.Dialect.Quote("name"),
		mg.Dialect.Quote("resource_version"),
		mg.Dialect.Quote("action"),
		mg.Dialect.Quote("folder"),
		mg.Dialect.Quote("key_path"))
	sql := fmt.Sprintf(`
		SELECT %s
		FROM resource_history
		WHERE (resource_version > %d OR (resource_version = %d AND guid > '%s'))
		AND key_path = ''
		ORDER BY resource_version ASC, guid ASC
		LIMIT 1000;
	`, cols, continueRow.ResourceVersion, continueRow.ResourceVersion, continueRow.GUID)
	if err := sess.SQL(sql).Find(&rows); err != nil {
		return nil, err
	}

	return rows, nil
}

type FixResourceDashboardVariableQuotesMigration struct {
	migrator.MigrationBase
}

func (m *FixResourceDashboardVariableQuotesMigration) SQL(dialect migrator.Dialect) string {
	return "code migration"
}

func (m *FixResourceDashboardVariableQuotesMigration) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	return RunFixResourceDashboardVariableQuotesMigration(sess, mg)
	// return nil
}

// Resource wrapper structures for JSON unmarshaling (Kubernetes-style)
type resourceWrapper struct {
	Kind       string                 `json:"kind,omitempty"`
	APIVersion string                 `json:"apiVersion,omitempty"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
	Spec       resourceDashboardData  `json:"spec,omitempty"`
	Status     map[string]interface{} `json:"status,omitempty"`
}

// Dashboard structures for JSON unmarshaling
type resourceDashboardData struct {
	Panels     []resourceDashboardPanel `json:"panels,omitempty"`
	Templating *resourceTemplating      `json:"templating,omitempty"`
}

type resourceTemplating struct {
	List []resourceTemplateVariable `json:"list,omitempty"`
}

type resourceTemplateVariable struct {
	Name       string `json:"name,omitempty"`
	IncludeAll bool   `json:"includeAll,omitempty"`
	Multi      bool   `json:"multi,omitempty"`
}

type resourceDashboardPanel struct {
	Datasource *resourceDatasource      `json:"datasource,omitempty"`
	Repeat     string                   `json:"repeat,omitempty"`
	Targets    []resourceTarget         `json:"targets,omitempty"`
	Panels     []resourceDashboardPanel `json:"panels,omitempty"` // For row panels
}

type resourceDatasource struct {
	Type string `json:"type,omitempty"`
}

type resourceTarget struct {
	RawSql string `json:"rawSql,omitempty"`
}

// removeQuotesAroundResourceVariable removes one set of quotes around template variable references.
// Handles both $var and ${var} formats.
// Only removes one layer of quotes (either single or double).
func removeQuotesAroundResourceVariable(sql, variableName string) string {
	// Skip if the SQL uses any format option like ${var:csv}
	formattedVarPattern := regexp.MustCompile(`\$\{` + regexp.QuoteMeta(variableName) + `:[^}]*\}`)
	if formattedVarPattern.MatchString(sql) {
		return sql
	}

	result := sql

	// Pattern for single quotes around $var or ${var}
	singleQuotePattern := regexp.MustCompile(`'(\$\{?` + regexp.QuoteMeta(variableName) + `\}?)'`)
	result = singleQuotePattern.ReplaceAllString(result, "$1")

	// Pattern for double quotes around $var or ${var}
	doubleQuotePattern := regexp.MustCompile(`"(\$\{?` + regexp.QuoteMeta(variableName) + `\}?)"`)
	result = doubleQuotePattern.ReplaceAllString(result, "$1")

	return result
}

// processResourcePanel processes a single panel and modifies its targets if conditions are met
func processResourcePanel(panel *resourceDashboardPanel, templatingList []resourceTemplateVariable) bool {
	modified := false

	// Check if panel meets the criteria
	if panel.Datasource == nil || panel.Datasource.Type != "grafana-postgresql-datasource" || panel.Repeat == "" {
		return modified
	}

	repeatVar := panel.Repeat

	// Find the template variable in templating.list
	var templateVar *resourceTemplateVariable
	for i := range templatingList {
		if templatingList[i].Name == repeatVar {
			templateVar = &templatingList[i]
			break
		}
	}

	if templateVar == nil || (!templateVar.IncludeAll && !templateVar.Multi) {
		return modified
	}

	// Modify the rawSql in all targets
	for i := range panel.Targets {
		if panel.Targets[i].RawSql != "" {
			originalSql := panel.Targets[i].RawSql
			panel.Targets[i].RawSql = removeQuotesAroundResourceVariable(originalSql, repeatVar)

			if panel.Targets[i].RawSql != originalSql {
				modified = true
			}
		}
	}

	return modified
}

// processResourcePanels recursively processes all panels including nested ones
func processResourcePanels(panels []resourceDashboardPanel, templatingList []resourceTemplateVariable) bool {
	modified := false

	for i := range panels {
		// Process the panel itself
		if processResourcePanel(&panels[i], templatingList) {
			modified = true
		}

		// Process nested panels (for row panels)
		if len(panels[i].Panels) > 0 {
			if processResourcePanels(panels[i].Panels, templatingList) {
				modified = true
			}
		}
	}

	return modified
}

// updateRawSqlInPanels recursively updates rawSql fields in the original panel maps
// This preserves all other fields that aren't in our struct
func updateRawSqlInPanels(originalPanels interface{}, modifiedPanels []resourceDashboardPanel) {
	panelsList, ok := originalPanels.([]interface{})
	if !ok {
		return
	}

	for i, panelInterface := range panelsList {
		if i >= len(modifiedPanels) {
			break
		}

		panelMap, ok := panelInterface.(map[string]interface{})
		if !ok {
			continue
		}

		modifiedPanel := modifiedPanels[i]

		// Update targets if they exist
		if len(modifiedPanel.Targets) > 0 {
			targetsInterface, ok := panelMap["targets"]
			if ok {
				targetsList, ok := targetsInterface.([]interface{})
				if ok {
					for j, targetInterface := range targetsList {
						if j >= len(modifiedPanel.Targets) {
							break
						}
						targetMap, ok := targetInterface.(map[string]interface{})
						if ok && modifiedPanel.Targets[j].RawSql != "" {
							targetMap["rawSql"] = modifiedPanel.Targets[j].RawSql
						}
					}
				}
			}
		}

		// Recursively update nested panels (for row panels)
		if len(modifiedPanel.Panels) > 0 {
			if nestedPanels, ok := panelMap["panels"]; ok {
				updateRawSqlInPanels(nestedPanels, modifiedPanel.Panels)
			}
		}
	}
}

// RunFixResourceDashboardVariableQuotesMigration performs the migration on resource and resource_history tables
func RunFixResourceDashboardVariableQuotesMigration(sess *xorm.Session, mg *migrator.Migrator) error {
	// Process resource table
	if err := processResourceTable(sess, mg); err != nil {
		return err
	}

	return nil
}

func processResourceTable(sess *xorm.Session, mg *migrator.Migrator) error {
	type resource struct {
		GUID  string `xorm:"guid"`
		Value string `xorm:"value"`
	}

	var resources []resource
	err := sess.Table("resource").
		Where("\"group\" = ?", "dashboard.grafana.app").
		Where("resource = ?", "dashboards").
		Cols("guid", "value").
		Find(&resources)

	if err != nil {
		return fmt.Errorf("failed to fetch resources: %w", err)
	}

	mg.Logger.Info("Starting resource dashboard variable quotes fix migration", "total_resources", len(resources))

	modifiedCount := 0
	errorCount := 0

	for _, res := range resources {
		// Skip empty value
		if strings.TrimSpace(res.Value) == "" {
			continue
		}

		// Parse resource wrapper as generic map to preserve all fields
		var wrapperMap map[string]interface{}
		if err := json.Unmarshal([]byte(res.Value), &wrapperMap); err != nil {
			mg.Logger.Warn("Failed to parse resource wrapper JSON", "resource_guid", res.GUID, "error", err)
			errorCount++
			continue
		}

		// Get the spec field as a map
		specInterface, ok := wrapperMap["spec"]
		if !ok {
			mg.Logger.Debug("Resource has no spec field, skipping", "resource_guid", res.GUID)
			continue
		}

		specMap, ok := specInterface.(map[string]interface{})
		if !ok {
			mg.Logger.Warn("Spec field is not an object", "resource_guid", res.GUID)
			errorCount++
			continue
		}

		// Marshal spec to JSON then unmarshal to our struct to process it
		specBytes, err := json.Marshal(specMap)
		if err != nil {
			mg.Logger.Warn("Failed to marshal spec", "resource_guid", res.GUID, "error", err)
			errorCount++
			continue
		}

		var dashData resourceDashboardData
		if err := json.Unmarshal(specBytes, &dashData); err != nil {
			mg.Logger.Debug("Failed to parse spec as dashboard (may not be a dashboard)", "resource_guid", res.GUID)
			continue
		}

		// Get templating list
		var templatingList []resourceTemplateVariable
		if dashData.Templating != nil {
			templatingList = dashData.Templating.List
		}

		// Process all panels
		modified := false
		if len(dashData.Panels) > 0 {
			modified = processResourcePanels(dashData.Panels, templatingList)
		}

		// If modified, update the resource
		if modified {
			// Update only the rawSql fields in the original panels map
			// This preserves all other fields that aren't in our struct
			if originalPanels, ok := specMap["panels"]; ok {
				updateRawSqlInPanels(originalPanels, dashData.Panels)
			}

			// Marshal the entire wrapper back to JSON
			updatedValue, err := json.Marshal(wrapperMap)
			if err != nil {
				mg.Logger.Warn("Failed to marshal updated resource wrapper JSON", "resource_guid", res.GUID, "error", err)
				errorCount++
				continue
			}

			// Update the resource in the database
			sqlUpdate := "UPDATE resource SET value = ? WHERE guid = ?"
			if mg.Dialect.DriverName() == migrator.Postgres {
				sqlUpdate = "UPDATE resource SET value = $1 WHERE guid = $2"
			}

			_, err = sess.Exec(sqlUpdate, string(updatedValue), res.GUID)
			if err != nil {
				mg.Logger.Warn("Failed to update resource", "resource_guid", res.GUID, "error", err)
				errorCount++
				continue
			}

			modifiedCount++
			mg.Logger.Debug("Fixed resource dashboard variable quotes", "resource_guid", res.GUID)
		}
	}

	mg.Logger.Info("Completed resource dashboard variable quotes fix migration",
		"total_resources", len(resources),
		"modified", modifiedCount,
		"errors", errorCount)

	return nil
}

func processResourceHistoryTable(sess *xorm.Session, mg *migrator.Migrator) error {
	type resourceHistory struct {
		GUID  string `xorm:"guid"`
		Value string `xorm:"value"`
	}

	var resources []resourceHistory
	err := sess.Table("resource_history").
		Where("\"group\" = ?", "dashboard.grafana.app").
		Where("resource = ?", "dashboards").
		Cols("guid", "value").
		Find(&resources)

	if err != nil {
		return fmt.Errorf("failed to fetch resource_history: %w", err)
	}

	mg.Logger.Info("Starting resource_history dashboard variable quotes fix migration", "total_resources", len(resources))

	modifiedCount := 0
	errorCount := 0

	for _, res := range resources {
		// Skip empty value
		if strings.TrimSpace(res.Value) == "" {
			continue
		}

		// Parse resource wrapper as generic map to preserve all fields
		var wrapperMap map[string]interface{}
		if err := json.Unmarshal([]byte(res.Value), &wrapperMap); err != nil {
			mg.Logger.Warn("Failed to parse resource_history wrapper JSON", "resource_guid", res.GUID, "error", err)
			errorCount++
			continue
		}

		// Get the spec field as a map
		specInterface, ok := wrapperMap["spec"]
		if !ok {
			mg.Logger.Debug("Resource history has no spec field, skipping", "resource_guid", res.GUID)
			continue
		}

		specMap, ok := specInterface.(map[string]interface{})
		if !ok {
			mg.Logger.Warn("Spec field is not an object in resource_history", "resource_guid", res.GUID)
			errorCount++
			continue
		}

		// Marshal spec to JSON then unmarshal to our struct to process it
		specBytes, err := json.Marshal(specMap)
		if err != nil {
			mg.Logger.Warn("Failed to marshal spec from resource_history", "resource_guid", res.GUID, "error", err)
			errorCount++
			continue
		}

		var dashData resourceDashboardData
		if err := json.Unmarshal(specBytes, &dashData); err != nil {
			mg.Logger.Debug("Failed to parse spec as dashboard from resource_history (may not be a dashboard)", "resource_guid", res.GUID)
			continue
		}

		// Get templating list
		var templatingList []resourceTemplateVariable
		if dashData.Templating != nil {
			templatingList = dashData.Templating.List
		}

		// Process all panels
		modified := false
		if len(dashData.Panels) > 0 {
			modified = processResourcePanels(dashData.Panels, templatingList)
		}

		// If modified, update the resource_history
		if modified {
			// Update only the rawSql fields in the original panels map
			// This preserves all other fields that aren't in our struct
			if originalPanels, ok := specMap["panels"]; ok {
				updateRawSqlInPanels(originalPanels, dashData.Panels)
			}

			// Marshal the entire wrapper back to JSON
			updatedValue, err := json.Marshal(wrapperMap)
			if err != nil {
				mg.Logger.Warn("Failed to marshal updated resource_history wrapper JSON", "resource_guid", res.GUID, "error", err)
				errorCount++
				continue
			}

			// Update the resource_history in the database
			sqlUpdate := "UPDATE resource_history SET value = ? WHERE guid = ?"
			if mg.Dialect.DriverName() == migrator.Postgres {
				sqlUpdate = "UPDATE resource_history SET value = $1 WHERE guid = $2"
			}

			_, err = sess.Exec(sqlUpdate, string(updatedValue), res.GUID)
			if err != nil {
				mg.Logger.Warn("Failed to update resource_history", "resource_guid", res.GUID, "error", err)
				errorCount++
				continue
			}

			modifiedCount++
			mg.Logger.Debug("Fixed resource_history dashboard variable quotes", "resource_guid", res.GUID)
		}
	}

	mg.Logger.Info("Completed resource_history dashboard variable quotes fix migration",
		"total_resources", len(resources),
		"modified", modifiedCount,
		"errors", errorCount)

	return nil
}
