// Package dashboard implements an embed.Extractor for Grafana dashboards.
// Walks the dashboard JSON via JSONPath, supporting both classic (v1) and
// v2 (k8s-shape) dashboards. Produces one embed.Item per panel.
package dashboard

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sort"
	"strconv"
	"strings"

	"github.com/PaesslerAG/jsonpath"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed"
)

// Extractor produces one embed.Item per panel.
type Extractor struct {
	logger *slog.Logger
}

func New() *Extractor {
	return &Extractor{logger: slog.Default()}
}

func (e *Extractor) Resource() string { return "dashboards" }

// Extract folder title doesn't exist on unified storage resources - so need to provide that
func (e *Extractor) Extract(ctx context.Context, key *resourcepb.ResourceKey, value []byte, folderTitle string) ([]embed.Item, error) {
	var dashboardJSON map[string]any
	if err := json.Unmarshal(value, &dashboardJSON); err != nil {
		return nil, fmt.Errorf("unmarshal dashboard: %w", err)
	}

	content, err := extractDashboardContent(ctx, dashboardJSON, e.logger)
	if err != nil {
		return nil, err
	}
	if folderTitle != "" {
		content.FolderTitle = folderTitle
	}

	uid := content.DashboardUID
	if uid == "" {
		uid = key.GetName()
	}
	if uid == "" {
		return nil, fmt.Errorf("dashboard has no UID")
	}

	items := make([]embed.Item, 0, len(content.Panels))
	for idx, p := range content.Panels {
		if it, ok := buildEmbeddableItem(content, p, uid, idx); ok {
			items = append(items, it)
		}
	}
	return items, nil
}

func buildEmbeddableItem(content *dashboardContent, p panelContent, uid string, idx int) (embed.Item, bool) {
	parts := make([]string, 0, 5)
	if content.FolderTitle != "" {
		parts = append(parts, content.FolderTitle)
	}
	if content.DashboardTitle != "" {
		parts = append(parts, content.DashboardTitle)
	}
	if p.RowName != "" {
		parts = append(parts, p.RowName)
	}
	if p.Title != "" {
		parts = append(parts, p.Title)
	}
	if p.Description != "" {
		parts = append(parts, p.Description)
	}
	breadcrumb := strings.Join(parts, " → ")

	var queryLines []string
	for i, q := range p.Queries {
		if q.Expression == "" {
			continue
		}
		if len(p.Queries) > 1 {
			queryLines = append(queryLines, fmt.Sprintf("Query %d: %s", i+1, q.Expression))
		} else {
			queryLines = append(queryLines, q.Expression)
		}
	}

	var sections []string
	if breadcrumb != "" {
		sections = append(sections, breadcrumb)
	}
	if len(content.Tags) > 0 {
		sections = append(sections, "Tags: "+strings.Join(content.Tags, ", "))
	}
	sections = append(sections, queryLines...)

	if len(sections) == 0 {
		return embed.Item{}, false
	}

	language := ""
	if len(p.Queries) > 0 && p.Queries[0].Language != "" {
		language = p.Queries[0].Language
	}

	md := map[string]any{
		"dashboardTitle": content.DashboardTitle,
		"panelIds":       []int{p.PanelID},
	}
	if content.FolderTitle != "" {
		md["folderTitle"] = content.FolderTitle
	}
	if p.RowName != "" {
		md["rowName"] = p.RowName
	}
	if p.DatasourceUID != "" {
		md["datasourceUid"] = p.DatasourceUID
	}
	if language != "" {
		md["language"] = language
	}
	mdJSON, _ := json.Marshal(md)

	return embed.Item{
		UID:         uid,
		Title:       displayTitle(content.DashboardTitle, p.Title, uid),
		Subresource: subresource(p.PanelID, idx),
		Content:     strings.Join(sections, "\n"),
		Metadata:    mdJSON,
		Folder:      content.FolderUID,
	}, true
}

// subresource is the unique sub-identifier for a panel within its dashboard.
// Mirrors grafana-assistant-app/api/internal/memory/dashboards.buildPanelVectors:
// non-zero panel ID wins; otherwise fall back to positional index.
func subresource(id int, idx int) string {
	if id != 0 {
		return fmt.Sprintf("panel/%d", id)
	}
	return fmt.Sprintf("panel/%d", idx)
}

// displayTitle is what cross-resource search shows. Combining dashboard +
// panel disambiguates panels with the same name across dashboards.
func displayTitle(dashboardTitle, panelTitle, uid string) string {
	switch {
	case dashboardTitle != "" && panelTitle != "":
		return dashboardTitle + " — " + panelTitle
	case dashboardTitle != "":
		return dashboardTitle
	case panelTitle != "":
		return panelTitle
	}
	return uid
}

// dashboardContent is the intermediate parsed representation.
type dashboardContent struct {
	DashboardUID   string
	DashboardTitle string
	Description    string
	FolderTitle    string
	FolderUID      string
	Tags           []string
	Panels         []panelContent
}

type panelContent struct {
	PanelID       int
	Title         string
	Description   string
	RowName       string
	Queries       []queryContent
	DatasourceUID string
}

type queryContent struct {
	RefID         string
	Language      string
	Expression    string
	DatasourceUID string
}

// jsonPathGet safely extracts a value using JSONPath, returning nil if not found.
func jsonPathGet(path string, data any) any {
	val, err := jsonpath.Get(path, data)
	if err != nil {
		return nil
	}
	return val
}

func extractString(path string, data any) string {
	return toString(jsonPathGet(path, data))
}

func extractInt(path string, data any) (int, bool) {
	return toInt(jsonPathGet(path, data))
}

func extractArray(path string, data any) []any {
	if arr, ok := jsonPathGet(path, data).([]any); ok {
		return arr
	}
	return nil
}

func extractMap(path string, data any) map[string]any {
	if m, ok := jsonPathGet(path, data).(map[string]any); ok {
		return m
	}
	return nil
}

// extractFolderUID reads the folder UID from the k8s annotation. Folder
// title is no longer extracted from JSON — it's passed in by the caller,
// which resolves it against the folder service (unified-storage values
// don't carry the title inline).
func extractFolderUID(dashboardJSON map[string]any) string {
	metadata, ok := dashboardJSON["metadata"].(map[string]any)
	if !ok {
		return ""
	}
	annotations, ok := metadata["annotations"].(map[string]any)
	if !ok {
		return ""
	}
	uid, _ := annotations["grafana.app/folder"].(string)
	return uid
}

// unwrapDashboard returns the dashboard body. Handles the Grafana API
// response wrapper {"dashboard": {...}} but leaves k8s {"spec": {...}}
// alone — JSONPath callers handle that explicitly.
func unwrapDashboard(dashboardJSON map[string]any) map[string]any {
	if d, ok := dashboardJSON["dashboard"].(map[string]any); ok {
		return d
	}
	return dashboardJSON
}

// extractDashboardContent parses dashboard JSON into the intermediate
// representation. Picks v1 vs v2 layout based on shape.
func extractDashboardContent(ctx context.Context, dashboardJSON map[string]any, logger *slog.Logger) (*dashboardContent, error) {
	dashboard := unwrapDashboard(dashboardJSON)

	isV2 := isDashboardV2(dashboardJSON)

	content := &dashboardContent{
		Panels:    []panelContent{},
		FolderUID: extractFolderUID(dashboardJSON),
	}

	if isV2 {
		return extractV2DashboardContent(ctx, dashboard, content, logger)
	}

	// Classic v1 may live at the root or under "spec" (k8s-wrapped v1).
	if _, hasUID := dashboard["uid"]; !hasUID {
		if _, hasPanels := dashboard["panels"]; !hasPanels {
			if spec, ok := dashboard["spec"].(map[string]any); ok {
				dashboard = spec
			}
		}
	}

	content.DashboardUID = extractString("$.uid", dashboard)
	content.DashboardTitle = extractString("$.title", dashboard)
	content.Description = extractString("$.description", dashboard)
	content.Tags = extractTags(dashboard)

	for _, pw := range extractPanelsWithRows(dashboard) {
		if panel := extractPanelContent(pw.panel, pw.rowName); panel != nil {
			content.Panels = append(content.Panels, *panel)
		}
	}
	return content, nil
}

// isDashboardV2 detects v2 (v2beta1, v2beta2, v2, …) by apiVersion or shape.
func isDashboardV2(dashboardJSON map[string]any) bool {
	dashboard := unwrapDashboard(dashboardJSON)

	if apiVersion := extractString("$.apiVersion", dashboard); strings.Contains(apiVersion, "dashboard.grafana.app/v2") {
		return true
	}

	if extractMap("$.spec.elements", dashboard) != nil {
		return true
	}

	elementsMap := extractMap("$.elements", dashboard)
	if elementsMap == nil {
		return false
	}

	for _, element := range elementsMap {
		if elementMap, ok := element.(map[string]any); ok {
			if extractString("$.kind", elementMap) == "Panel" {
				return true
			}
		}
	}
	return false
}

// extractTags extracts user-supplied tags. Classic dashboards use $.tags;
// v2 uses $.spec.tags. K8s `metadata.labels` is intentionally not consulted —
// in unified storage it holds system labels (e.g. grafana.app/...), not user
// tags.
func extractTags(dashboardJSON map[string]any) []string {
	for _, path := range []string{"$.tags", "$.spec.tags"} {
		if tagsArr := extractArray(path, dashboardJSON); tagsArr != nil {
			tags := make([]string, 0, len(tagsArr))
			for _, tag := range tagsArr {
				if tagStr, ok := tag.(string); ok {
					tagStr = strings.TrimSpace(tagStr)
					if tagStr != "" {
						tags = append(tags, tagStr)
					}
				}
			}
			if len(tags) > 0 {
				return tags
			}
		}
	}

	return nil
}

func extractV2Metadata(dashboardJSON map[string]any) (uid, title string) {
	uid = extractString("$.metadata.name", dashboardJSON)
	if uid == "" {
		uid = extractString("$.metadata.uid", dashboardJSON)
	}
	if uid == "" {
		uid = extractString("$.uid", dashboardJSON)
	}

	title = extractString("$.spec.title", dashboardJSON)
	if title == "" {
		title = extractString("$.title", dashboardJSON)
	}
	return uid, title
}

func extractV2ElementsMap(dashboardJSON map[string]any) map[string]any {
	if elements := extractMap("$.spec.elements", dashboardJSON); elements != nil {
		return elements
	}
	return extractMap("$.elements", dashboardJSON)
}

func extractV2DashboardContent(ctx context.Context, dashboardJSON map[string]any, content *dashboardContent, logger *slog.Logger) (*dashboardContent, error) {
	content.DashboardUID, content.DashboardTitle = extractV2Metadata(dashboardJSON)
	content.Tags = extractTags(dashboardJSON)

	panelToRowMap := extractV2PanelToRowMap(dashboardJSON)
	elementsMap := extractV2ElementsMap(dashboardJSON)

	if elementsMap == nil {
		logger.WarnContext(ctx, "no elements map found in v2 dashboard",
			"hasSpec", extractMap("$.spec", dashboardJSON) != nil,
			"hasElements", extractMap("$.elements", dashboardJSON) != nil)
		return content, nil
	}

	// Sort keys so iteration order — and hence the positional fallback in
	// subresource() — is deterministic across runs.
	keys := make([]string, 0, len(elementsMap))
	for key := range elementsMap {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	for _, key := range keys {
		element := elementsMap[key]
		elementMap, ok := element.(map[string]any)
		if !ok || extractString("$.kind", elementMap) != "Panel" {
			continue
		}

		if panel := extractV2PanelContent(elementMap, panelToRowMap[key]); panel != nil {
			content.Panels = append(content.Panels, *panel)
		}
	}
	return content, nil
}

func extractV2PanelContent(element map[string]any, rowName string) *panelContent {
	panel := &panelContent{
		Queries: []queryContent{},
		RowName: rowName,
	}

	spec, ok := element["spec"].(map[string]any)
	if !ok {
		return nil
	}

	if idInt, ok := extractInt("$.id", spec); ok {
		panel.PanelID = idInt
	}
	panel.Title = extractString("$.title", spec)
	panel.Description = extractString("$.description", spec)

	if queryList := extractArray("$.data.spec.queries[*]", spec); queryList != nil {
		for _, q := range queryList {
			if queryMap, ok := q.(map[string]any); ok {
				if query := extractV2QueryContent(queryMap); query != nil {
					panel.Queries = append(panel.Queries, *query)
					if panel.DatasourceUID == "" && query.DatasourceUID != "" {
						panel.DatasourceUID = query.DatasourceUID
					}
				}
			}
		}
	}
	return panel
}

// extractV2PanelToRowMap walks the v2 layout and returns a panel-key → row-title
// map.
func extractV2PanelToRowMap(dashboardJSON map[string]any) map[string]string {
	panelToRow := make(map[string]string)

	layout := extractMap("$.spec.layout", dashboardJSON)
	if layout == nil {
		layout = extractMap("$.layout", dashboardJSON)
	}
	if layout == nil {
		return panelToRow
	}

	rowsList := extractArray("$.spec.rows[*]", layout)
	if rowsList == nil {
		return panelToRow
	}

	for _, row := range rowsList {
		rowMap, ok := row.(map[string]any)
		if !ok {
			continue
		}

		rowSpec := extractMap("$.spec", rowMap)
		rowTitle := extractString("$.title", rowSpec)
		if rowTitle == "" {
			continue
		}

		itemsList := extractArray("$.layout.spec.items[*]", rowSpec)
		if itemsList == nil {
			continue
		}

		for _, item := range itemsList {
			itemMap, ok := item.(map[string]any)
			if !ok {
				continue
			}
			panelKey := extractString("$.spec.element.name", itemMap)
			if panelKey != "" {
				panelToRow[panelKey] = rowTitle
			}
		}
	}
	return panelToRow
}

func extractV2QueryContent(queryMap map[string]any) *queryContent {
	query := &queryContent{}

	querySpec, ok := queryMap["spec"].(map[string]any)
	if !ok {
		return nil
	}
	query.RefID = extractString("$.refId", querySpec)

	queryObj, ok := querySpec["query"].(map[string]any)
	if !ok {
		return nil
	}

	if ds, ok := queryObj["datasource"].(map[string]any); ok {
		// V2 datasource refs use `name` (which is the datasource UID in
		// unified storage). Fall back to `uid` for tolerance.
		if dsName, ok := ds["name"].(string); ok && dsName != "" {
			query.DatasourceUID = dsName
		} else if dsUID, ok := ds["uid"].(string); ok {
			query.DatasourceUID = dsUID
		}
	}
	if group, ok := queryObj["group"].(string); ok {
		query.Language = inferLanguage(group)
	}

	if queryDataSpec, ok := queryObj["spec"].(map[string]any); ok {
		query.Expression, query.Language = extractQueryExpression(queryDataSpec, query.Language)
	}
	return query
}

// panelWithRow pairs a panel with its row title (empty if the panel is not
// inside a row).
type panelWithRow struct {
	panel   map[string]any
	rowName string
}

// extractPanelsWithRows handles both classic shapes:
//   - old: top-level `rows[]` each with nested `panels[]`
//   - new: flat `panels[]` with `type:"row"` markers (which may collapse
//     nested panels)
func extractPanelsWithRows(dashboard map[string]any) []panelWithRow {
	var panelsWithRows []panelWithRow

	if rowsList := extractArray("$.rows[*]", dashboard); rowsList != nil {
		for _, row := range rowsList {
			if rowMap, ok := row.(map[string]any); ok {
				rowTitle := extractString("$.title", rowMap)
				if rowPanelList := extractArray("$.panels[*]", rowMap); rowPanelList != nil {
					for _, rp := range rowPanelList {
						if rpMap, ok := rp.(map[string]any); ok {
							panelsWithRows = append(panelsWithRows, panelWithRow{
								panel:   rpMap,
								rowName: rowTitle,
							})
						}
					}
				}
			}
		}
		if len(panelsWithRows) > 0 {
			return panelsWithRows
		}
	}

	if panelList := extractArray("$.panels[*]", dashboard); panelList != nil {
		rows := make(map[int]string) // y position → row title
		var allPanels []map[string]any

		for _, p := range panelList {
			panelMap, ok := p.(map[string]any)
			if !ok {
				continue
			}
			if extractString("$.type", panelMap) != "row" {
				allPanels = append(allPanels, panelMap)
				continue
			}
			// Collapsed row: nested panels carry the row title.
			if rowPanelList := extractArray("$.panels[*]", panelMap); len(rowPanelList) > 0 {
				rowTitle := extractString("$.title", panelMap)
				for _, rp := range rowPanelList {
					if rpMap, ok := rp.(map[string]any); ok {
						panelsWithRows = append(panelsWithRows, panelWithRow{
							panel:   rpMap,
							rowName: rowTitle,
						})
					}
				}
				continue
			}
			// Plain row marker: remember y-position so flat panels below it
			// can pick it up.
			rowTitle := extractString("$.title", panelMap)
			if gridPos := extractMap("$.gridPos", panelMap); gridPos != nil {
				if y, ok := gridPos["y"].(float64); ok {
					rows[int(y)] = rowTitle
				}
			}
		}

		for _, panelMap := range allPanels {
			rowName := ""
			if len(rows) > 0 {
				if gridPos := extractMap("$.gridPos", panelMap); gridPos != nil {
					if y, ok := gridPos["y"].(float64); ok {
						panelY := int(y)
						closestY := -1
						for rowY, title := range rows {
							if rowY <= panelY && rowY > closestY {
								closestY = rowY
								rowName = title
							}
						}
					}
				}
			}
			panelsWithRows = append(panelsWithRows, panelWithRow{
				panel:   panelMap,
				rowName: rowName,
			})
		}
	}
	return panelsWithRows
}

func extractPanelContent(panel map[string]any, rowName string) *panelContent {
	pc := &panelContent{
		Queries: []queryContent{},
		RowName: rowName,
	}

	if idInt, ok := extractInt("$.id", panel); ok {
		pc.PanelID = idInt
	}
	pc.Title = extractString("$.title", panel)
	pc.Description = extractString("$.description", panel)
	pc.DatasourceUID = extractString("$.datasource.uid", panel)

	if targetList := extractArray("$.targets[*]", panel); targetList != nil {
		for _, t := range targetList {
			if targetMap, ok := t.(map[string]any); ok {
				if query := extractQueryContent(targetMap, pc.DatasourceUID); query != nil {
					pc.Queries = append(pc.Queries, *query)
					if pc.DatasourceUID == "" && query.DatasourceUID != "" {
						pc.DatasourceUID = query.DatasourceUID
					}
				}
			}
		}
	}
	return pc
}

func extractQueryContent(target map[string]any, defaultDatasourceUID string) *queryContent {
	query := &queryContent{}

	query.RefID = extractString("$.refId", target)
	if dsUID := extractString("$.datasource.uid", target); dsUID != "" {
		query.DatasourceUID = dsUID
	} else if defaultDatasourceUID != "" {
		query.DatasourceUID = defaultDatasourceUID
	}

	if dsType := extractString("$.datasource.type", target); dsType != "" {
		query.Language = inferLanguage(dsType)
	}

	query.Expression, query.Language = extractQueryExpression(target, query.Language)
	return query
}

// extractQueryExpression pulls the query string out of a target/query spec.
// Tries `expr` (PromQL/LogQL), `rawSql`/`rawQuery` (SQL-likes), `query`
// (TraceQL), then `queryString` (plugin datasources like grafana-incident).
func extractQueryExpression(querySpec map[string]any, currentLanguage string) (string, string) {
	if expr, ok := querySpec["expr"].(string); ok && expr != "" {
		return expr, currentLanguage
	}
	if rawSql, ok := querySpec["rawSql"].(string); ok && rawSql != "" {
		return rawSql, "sql"
	}
	if rawQuery, ok := querySpec["rawQuery"].(string); ok && rawQuery != "" {
		return rawQuery, "sql"
	}
	if q, ok := querySpec["query"].(string); ok && q != "" {
		return q, "traceql"
	}
	// queryString is a generic plugin-defined field — keep whatever language
	// was inferred from the datasource type (often empty for plugins).
	if qs, ok := querySpec["queryString"].(string); ok && qs != "" {
		return qs, currentLanguage
	}
	return "", currentLanguage
}

func inferLanguage(dsType string) string {
	dsType = strings.ToLower(dsType)
	switch {
	case strings.Contains(dsType, "prometheus"):
		return "promql"
	case strings.Contains(dsType, "loki"):
		return "logql"
	case strings.Contains(dsType, "tempo"):
		return "traceql"
	case strings.Contains(dsType, "mysql") || strings.Contains(dsType, "postgres") ||
		strings.Contains(dsType, "mssql") || strings.Contains(dsType, "clickhouse") ||
		strings.Contains(dsType, "bigquery") || strings.Contains(dsType, "snowflake") ||
		strings.Contains(dsType, "sql"):
		return "sql"
	}
	return ""
}

func toString(v any) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}

func toInt(v any) (int, bool) {
	if v == nil {
		return 0, false
	}
	switch val := v.(type) {
	case int:
		return val, true
	case int64:
		return int(val), true
	case float64:
		return int(val), true
	case string:
		if i, err := strconv.Atoi(val); err == nil {
			return i, true
		}
	}
	return 0, false
}
