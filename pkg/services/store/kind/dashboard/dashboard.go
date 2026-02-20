package dashboard

import (
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"

	jsoniter "github.com/json-iterator/go"

	"github.com/grafana/grafana/pkg/infra/log"
)

type templateVariable struct {
	current struct {
		value any
	}
	name         string
	query        any
	variableType string
}

type datasourceVariableLookup struct {
	variableNameToRefs map[string][]DataSourceRef
	dsLookup           DatasourceLookup
}

func (d *datasourceVariableLookup) getDsRefsByTemplateVariableValue(value string, datasourceType string) []DataSourceRef {
	switch value {
	case "default":
		// can be the default DS, or a DS with UID="default"
		candidateDs := d.dsLookup.ByRef(&DataSourceRef{UID: value})
		if candidateDs == nil {
			// get the actual default DS
			candidateDs = d.dsLookup.ByRef(nil)
		}

		if candidateDs != nil {
			return []DataSourceRef{*candidateDs}
		}
		return []DataSourceRef{}
	case "$__all":
		// TODO: filter datasources by template variable's regex
		return d.dsLookup.ByType(datasourceType)
	case "":
		return []DataSourceRef{}
	case "No data sources found":
		return []DataSourceRef{}
	default:
		// some variables use `ds.name` rather than `ds.uid`
		if ref := d.dsLookup.ByRef(&DataSourceRef{
			UID: value,
		}); ref != nil {
			return []DataSourceRef{*ref}
		}

		// discard variable
		return []DataSourceRef{}
	}
}

func (d *datasourceVariableLookup) add(templateVariable templateVariable) {
	var refs []DataSourceRef

	datasourceType, isDataSourceTypeValid := templateVariable.query.(string)
	if !isDataSourceTypeValid {
		d.variableNameToRefs[templateVariable.name] = refs
		return
	}

	if values, multiValueVariable := templateVariable.current.value.([]any); multiValueVariable {
		for _, value := range values {
			if valueAsString, ok := value.(string); ok {
				refs = append(refs, d.getDsRefsByTemplateVariableValue(valueAsString, datasourceType)...)
			}
		}
	}

	if value, stringValue := templateVariable.current.value.(string); stringValue {
		refs = append(refs, d.getDsRefsByTemplateVariableValue(value, datasourceType)...)
	}

	d.variableNameToRefs[templateVariable.name] = unique(refs)
}

func unique(refs []DataSourceRef) []DataSourceRef {
	var uniqueRefs []DataSourceRef
	uidPresence := make(map[string]bool)
	for _, ref := range refs {
		if !uidPresence[ref.UID] {
			uidPresence[ref.UID] = true
			uniqueRefs = append(uniqueRefs, ref)
		}
	}
	return uniqueRefs
}

func (d *datasourceVariableLookup) getDatasourceRefs(name string) []DataSourceRef {
	refs, ok := d.variableNameToRefs[name]
	if ok {
		return refs
	}

	return []DataSourceRef{}
}

func newDatasourceVariableLookup(dsLookup DatasourceLookup) *datasourceVariableLookup {
	return &datasourceVariableLookup{
		variableNameToRefs: make(map[string][]DataSourceRef),
		dsLookup:           dsLookup,
	}
}

// ReadDashboard will take a byte stream and return dashboard info
func ReadDashboard(stream io.Reader, lookup DatasourceLookup) (*DashboardSummaryInfo, error) {
	return ReadDashboardWithLogContext(stream, lookup, nil)
}

func ReadDashboardWithLogContext(stream io.Reader, lookup DatasourceLookup, logContext map[string]any) (*DashboardSummaryInfo, error) {
	iter := jsoniter.Parse(jsoniter.ConfigDefault, stream, 1024)
	return readDashboardIter("$", iter, lookup, logContext)
}

// nolint:gocyclo
func readDashboardIter(jsonPath string, iter *jsoniter.Iterator, lookup DatasourceLookup, lc map[string]any) (*DashboardSummaryInfo, error) {
	dash := &DashboardSummaryInfo{}

	if !checkAndSkipUnexpectedElement(iter, jsonPath, lc, jsoniter.ObjectValue) {
		return dash, errors.New("expected JSON object at " + jsonPath)
	}

	datasourceVariablesLookup := newDatasourceVariableLookup(lookup)

	for field := iter.ReadObject(); field != ""; field = iter.ReadObject() {
		// Skip null values so we don't need special int handling
		if iter.WhatIsNext() == jsoniter.NilValue {
			iter.Skip()
			continue
		}

		switch field {
		// k8s metadata wrappers (skip)
		case "metadata", "kind", "apiVersion":
			iter.Skip()

		// recursively read the spec as dashboard json
		case "spec":
			return readDashboardIter(jsonPath+".spec", iter, lookup, lc)

		case "id":
			if !checkAndSkipUnexpectedElement(iter, jsonPath+".id", lc, jsoniter.NumberValue) {
				continue
			}
			dash.ID = iter.ReadInt64()

		case "title":
			if !checkAndSkipUnexpectedElement(iter, jsonPath+".title", lc, jsoniter.StringValue) {
				continue
			}
			dash.Title = iter.ReadString()

		case "description":
			if !checkAndSkipUnexpectedElement(iter, jsonPath+".description", lc, jsoniter.StringValue) {
				continue
			}
			dash.Description = iter.ReadString()

		case "schemaVersion":
			if !checkAndSkipUnexpectedElement(iter, jsonPath+".schemaVersion", lc, jsoniter.NumberValue, jsoniter.StringValue) {
				continue
			}

			switch iter.WhatIsNext() {
			case jsoniter.NumberValue:
				dash.SchemaVersion = iter.ReadInt64()
			case jsoniter.StringValue:
				val := iter.ReadString()
				if v, err := strconv.ParseInt(val, 10, 64); err == nil {
					dash.SchemaVersion = v
				}
			default:
				iter.Skip()
			}

		case "timezone":
			if !checkAndSkipUnexpectedElement(iter, jsonPath+".timezone", lc, jsoniter.StringValue) {
				continue
			}
			dash.TimeZone = iter.ReadString()

		case "editable":
			if !checkAndSkipUnexpectedElement(iter, jsonPath+".editable", lc, jsoniter.StringValue, jsoniter.BoolValue) {
				continue
			}

			switch iter.WhatIsNext() {
			case jsoniter.BoolValue:
				dash.ReadOnly = !iter.ReadBool()
			case jsoniter.StringValue:
				dash.ReadOnly = iter.ReadString() != "true"
			default:
				iter.Skip()
			}

		case "refresh":
			// "refresh" used to be boolean. We will silently skip it in such case.
			if !checkAndSkipUnexpectedElement(iter, jsonPath+".refresh", lc, jsoniter.StringValue, jsoniter.BoolValue) {
				continue
			}

			if iter.WhatIsNext() == jsoniter.BoolValue {
				iter.Skip()
				continue
			}
			dash.Refresh = iter.ReadString()

		case "tags":
			tagsPath := jsonPath + ".tags"

			// Only support string array tags. Ignore everything else.
			if !checkAndSkipUnexpectedElement(iter, tagsPath, lc, jsoniter.ArrayValue) {
				continue
			}

			for ix := 0; iter.ReadArray(); ix++ {
				if !checkAndSkipUnexpectedElement(iter, fmt.Sprintf("%s[%d]", tagsPath, ix), lc, jsoniter.StringValue) {
					continue
				}

				dash.Tags = append(dash.Tags, iter.ReadString())
			}

		case "links":
			if !checkAndSkipUnexpectedElement(iter, jsonPath+".links", lc, jsoniter.ArrayValue) {
				continue
			}

			for iter.ReadArray() {
				iter.Skip()
				dash.LinkCount++
			}

		case "time":
			if !checkAndSkipUnexpectedElement(iter, jsonPath+".time", lc, jsoniter.ObjectValue) {
				continue
			}

			obj, ok := iter.Read().(map[string]any)
			if ok {
				if timeFrom, ok := obj["from"].(string); ok {
					dash.TimeFrom = timeFrom
				}
				if timeTo, ok := obj["to"].(string); ok {
					dash.TimeTo = timeTo
				}
			}

		case "panels":
			panelsPath := jsonPath + ".panels"
			if !checkAndSkipUnexpectedElement(iter, panelsPath, lc, jsoniter.ArrayValue) {
				continue
			}

			for ix := 0; iter.ReadArray(); ix++ {
				p, ok := readpanelInfo(iter, lookup, fmt.Sprintf("%s[%d]", panelsPath, ix), lc)
				if ok {
					dash.Panels = append(dash.Panels, p)
				}
			}

		case "elements":
			// needed for v2 dashboards
			elementsPath := jsonPath + ".elements"
			if !checkAndSkipUnexpectedElement(iter, elementsPath, lc, jsoniter.ObjectValue) {
				continue
			}
			for elementKey := iter.ReadObject(); elementKey != ""; elementKey = iter.ReadObject() {
				p, ok := readV2ElementInfo(iter, lookup, fmt.Sprintf("%s.%s", elementsPath, elementKey), lc)
				if ok {
					dash.Panels = append(dash.Panels, p)
				}
			}

		case "templating":
			templatingPath := jsonPath + ".templating"
			if !checkAndSkipUnexpectedElement(iter, templatingPath, lc, jsoniter.ObjectValue) {
				continue
			}

			for sub := iter.ReadObject(); sub != ""; sub = iter.ReadObject() {
				// Skip all null values silently.
				if iter.WhatIsNext() == jsoniter.NilValue {
					iter.Skip()
					continue
				}

				if sub == "list" {
					templatingListPath := templatingPath + ".list"
					if !checkAndSkipUnexpectedElement(iter, templatingListPath, lc, jsoniter.ArrayValue) {
						continue
					}

					for ix := 0; iter.ReadArray(); ix++ {
						// Skip all null elements silently.
						if iter.WhatIsNext() == jsoniter.NilValue {
							iter.Skip()
							continue
						}

						tv := templateVariable{}

						templatingListElementPath := fmt.Sprintf("%s[%d]", templatingListPath, ix)
						if !checkAndSkipUnexpectedElement(iter, templatingListElementPath, lc, jsoniter.ObjectValue) {
							continue
						}

						for k := iter.ReadObject(); k != ""; k = iter.ReadObject() {
							switch k {
							case "name":
								if !checkAndSkipUnexpectedElement(iter, templatingListElementPath+".name", lc, jsoniter.StringValue) {
									continue
								}

								name := iter.ReadString()
								dash.TemplateVars = append(dash.TemplateVars, name)
								tv.name = name
							case "type":
								if !checkAndSkipUnexpectedElement(iter, templatingListElementPath+".type", lc, jsoniter.StringValue) {
									continue
								}
								tv.variableType = iter.ReadString()
							case "query":
								tv.query = iter.Read()
							case "current":
								if !checkAndSkipUnexpectedElement(iter, templatingListElementPath+".current", lc, jsoniter.ObjectValue, jsoniter.ArrayValue) {
									continue
								}

								if iter.WhatIsNext() == jsoniter.ArrayValue {
									iter.Skip()
									continue
								}

								for c := iter.ReadObject(); c != ""; c = iter.ReadObject() {
									if c == "value" {
										tv.current.value = iter.Read()
									} else {
										iter.Skip()
									}
								}
							default:
								iter.Skip()
							}
						}

						if tv.variableType == "datasource" {
							datasourceVariablesLookup.add(tv)
						}
					}
				} else {
					iter.Skip()
				}
			}

		// Ignore everything else
		default:
			iter.Skip()
		}
	}

	replaceDatasourceVariables(dash, datasourceVariablesLookup)
	fillDefaultDatasources(dash, lookup)
	filterOutSpecialDatasources(dash)

	targets := newTargetInfo(lookup)
	for idx, panel := range dash.Panels {
		if panel.Type == "row" {
			dash.Panels[idx].Datasource = nil
			continue
		}

		targets.addPanel(panel)
	}
	dash.Datasource = targets.GetDatasourceInfo()

	return dash, iter.Error
}

var logger = log.New("services.store.kind.dashboard")

// checkAndSkipUnexpectedElement verifies if the next JSON element matches any allowed value types for the specified JSON path.
// If the type matches, it returns true, otherwise it skips the element, logs an error, and returns false.
func checkAndSkipUnexpectedElement(iter *jsoniter.Iterator, jsonPath string, logContext map[string]any, allowedValues ...jsoniter.ValueType) bool {
	next := iter.WhatIsNext()
	for _, a := range allowedValues {
		if next == a {
			return true
		}
	}

	// Skip unexpected element.
	iter.Skip()

	// Prepare log message.
	params := []any{
		"jsonPath", jsonPath,
		"got", valueTypesToString(next),
		"expected", valueTypesToString(allowedValues...),
	}

	// Map iteration is random, so a log message may look different each time if there are multiple entries in the map. That's fine.
	for k, v := range logContext {
		params = append(params, k, v)
	}

	logger.Error("Unexpected element in Dashboard JSON", params...)
	return false
}

func valueTypesToString(allowedValues ...jsoniter.ValueType) string {
	expected := strings.Builder{}
	for ix, a := range allowedValues {
		if ix > 0 {
			expected.WriteString(", ")
		}

		switch a {
		case jsoniter.NilValue:
			expected.WriteString("null")
		case jsoniter.StringValue:
			expected.WriteString("string")
		case jsoniter.NumberValue:
			expected.WriteString("number")
		case jsoniter.BoolValue:
			expected.WriteString("bool")
		case jsoniter.ArrayValue:
			expected.WriteString("array")
		case jsoniter.ObjectValue:
			expected.WriteString("object")
		default:
			expected.WriteString(fmt.Sprintf("unknown: %d", a))
		}
	}
	return expected.String()
}

func panelRequiresDatasource(panel PanelSummaryInfo) bool {
	return panel.Type != "row"
}

func fillDefaultDatasources(dash *DashboardSummaryInfo, lookup DatasourceLookup) {
	for i, panel := range dash.Panels {
		if len(panel.Datasource) != 0 || !panelRequiresDatasource(PanelSummaryInfo{}) {
			continue
		}

		defaultDs := lookup.ByRef(nil)
		if defaultDs != nil {
			dash.Panels[i].Datasource = []DataSourceRef{*defaultDs}
		}
	}
}

func filterOutSpecialDatasources(dash *DashboardSummaryInfo) {
	for i := range dash.Panels {
		dash.Panels[i].Datasource = filterSpecialDatasourcesFromRefs(dash.Panels[i].Datasource)
	}
}

func replaceDatasourceVariables(dash *DashboardSummaryInfo, datasourceVariablesLookup *datasourceVariableLookup) {
	for i, panel := range dash.Panels {
		var dsVariableRefs []DataSourceRef
		var dsRefs []DataSourceRef

		// partition into actual datasource references and variables
		for i := range panel.Datasource {
			uid := panel.Datasource[i].UID
			if isVariableRef(uid) {
				dsVariableRefs = append(dsVariableRefs, panel.Datasource[i])
			} else {
				dsRefs = append(dsRefs, panel.Datasource[i])
			}
		}

		variables := findDatasourceRefsForVariables(dsVariableRefs, datasourceVariablesLookup)
		dash.Panels[i].Datasource = append(dsRefs, variables...)
	}
}

// special datasource UIDs that should be excluded from indexed panel datasource refs
const (
	specialDSMixed     = "-- Mixed --"
	specialDSDashboard = "-- Dashboard --"
	specialDSGrafana   = "grafana"
)

func isSpecialDatasource(uid string) bool {
	return uid == specialDSMixed || uid == specialDSDashboard || uid == specialDSGrafana
}

func filterSpecialDatasourcesFromRefs(refs []DataSourceRef) []DataSourceRef {
	if len(refs) == 0 {
		return refs
	}
	out := make([]DataSourceRef, 0, len(refs))
	for _, ds := range refs {
		if !isSpecialDatasource(ds.UID) {
			out = append(out, ds)
		}
	}
	return out
}

func isVariableRef(uid string) bool {
	return strings.HasPrefix(uid, "$")
}

func getDataSourceVariableName(dsVariableRef DataSourceRef) string {
	if strings.HasPrefix(dsVariableRef.UID, "${") {
		return strings.TrimPrefix(strings.TrimSuffix(dsVariableRef.UID, "}"), "${")
	}

	return strings.TrimPrefix(dsVariableRef.UID, "$")
}

func findDatasourceRefsForVariables(dsVariableRefs []DataSourceRef, datasourceVariablesLookup *datasourceVariableLookup) []DataSourceRef {
	var referencedDs []DataSourceRef //nolint:prealloc
	for _, dsVariableRef := range dsVariableRefs {
		variableName := getDataSourceVariableName(dsVariableRef)
		refs := datasourceVariablesLookup.getDatasourceRefs(variableName)
		referencedDs = append(referencedDs, refs...)
	}
	return referencedDs
}

// nolint:gocyclo
func readpanelInfo(iter *jsoniter.Iterator, lookup DatasourceLookup, jsonPath string, lc map[string]any) (PanelSummaryInfo, bool) {
	panel := PanelSummaryInfo{}

	if !checkAndSkipUnexpectedElement(iter, jsonPath, lc, jsoniter.ObjectValue) {
		return panel, false
	}

	targets := newTargetInfo(lookup)

	for field := iter.ReadObject(); field != ""; field = iter.ReadObject() {
		if iter.WhatIsNext() == jsoniter.NilValue {
			if field == "datasource" {
				targets.addDatasource(iter, jsonPath+".datasource", lc)
				continue
			}

			// Skip null values so we don't need special int handling
			iter.Skip()
			continue
		}

		switch field {
		case "id":
			if !checkAndSkipUnexpectedElement(iter, jsonPath+".id", lc, jsoniter.NumberValue, jsoniter.StringValue) {
				continue
			}

			if iter.WhatIsNext() == jsoniter.StringValue {
				id, err := strconv.ParseInt(iter.ReadString(), 10, 64)
				if err == nil {
					panel.ID = id
				}
			} else {
				panel.ID = iter.ReadInt64()
			}

		case "type":
			if !checkAndSkipUnexpectedElement(iter, jsonPath+".type", lc, jsoniter.StringValue) {
				continue
			}
			panel.Type = iter.ReadString()

		case "title":
			if !checkAndSkipUnexpectedElement(iter, jsonPath+".title", lc, jsoniter.StringValue) {
				continue
			}
			panel.Title = iter.ReadString()

		case "description":
			if !checkAndSkipUnexpectedElement(iter, jsonPath+".description", lc, jsoniter.StringValue) {
				continue
			}
			panel.Description = iter.ReadString()

		case "pluginVersion":
			if !checkAndSkipUnexpectedElement(iter, jsonPath+".pluginVersion", lc, jsoniter.StringValue) {
				continue
			}
			panel.PluginVersion = iter.ReadString() // since 7x (the saved version for the plugin model)

		case "libraryPanel":
			if !checkAndSkipUnexpectedElement(iter, jsonPath+".libraryPanel", lc, jsoniter.ObjectValue) {
				continue
			}

			var v map[string]interface{}
			iter.ReadVal(&v)
			if uid, ok := v["uid"]; ok {
				if u, isString := uid.(string); isString {
					panel.LibraryPanel = u
				}
			}

		case "datasource":
			targets.addDatasource(iter, jsonPath+".datasource", lc)

		case "targets":
			if !checkAndSkipUnexpectedElement(iter, jsonPath+".targets", lc, jsoniter.ArrayValue, jsoniter.ObjectValue) {
				continue
			}

			switch iter.WhatIsNext() {
			case jsoniter.ArrayValue:
				for ix := 0; iter.ReadArray(); ix++ {
					targets.addTarget(iter, fmt.Sprintf("%s.targets[%d]", jsonPath, ix), lc)
				}
			case jsoniter.ObjectValue:
				for fn := iter.ReadObject(); fn != ""; fn = iter.ReadObject() {
					targets.addTarget(iter, jsonPath+".targets."+fn, lc)
				}
			default:
				iter.Skip()
			}

		case "transformations":
			if !checkAndSkipUnexpectedElement(iter, jsonPath+".transformations", lc, jsoniter.ArrayValue) {
				continue
			}

			for ix := 0; iter.ReadArray(); ix++ {
				if !checkAndSkipUnexpectedElement(iter, fmt.Sprintf("%s.transformations[%d]", jsonPath, ix), lc, jsoniter.ObjectValue) {
					continue
				}

				for sub := iter.ReadObject(); sub != ""; sub = iter.ReadObject() {
					if sub == "id" {
						if !checkAndSkipUnexpectedElement(iter, fmt.Sprintf("%s.transformations[%d].id", jsonPath, ix), lc, jsoniter.StringValue) {
							continue
						}

						panel.Transformer = append(panel.Transformer, iter.ReadString())
					} else {
						iter.Skip()
					}
				}
			}

		// Rows have nested panels
		case "panels":
			if !checkAndSkipUnexpectedElement(iter, jsonPath+".panels", lc, jsoniter.ArrayValue) {
				continue
			}

			for ix := 0; iter.ReadArray(); ix++ {
				p, ok := readpanelInfo(iter, lookup, fmt.Sprintf("%s.panels[%d]", jsonPath, ix), lc)
				if ok {
					panel.Collapsed = append(panel.Collapsed, p)
				}
			}

		case "options", "gridPos", "fieldConfig":
			iter.Skip()

		default:
			iter.Skip()
		}
	}

	panel.Datasource = targets.GetDatasourceInfo()

	return panel, true
}

func readV2ElementInfo(iter *jsoniter.Iterator, lookup DatasourceLookup, jsonPath string, lc map[string]any) (PanelSummaryInfo, bool) {
	if !checkAndSkipUnexpectedElement(iter, jsonPath, lc, jsoniter.ObjectValue) {
		return PanelSummaryInfo{}, false
	}
	var kind string
	var panel PanelSummaryInfo
	for field := iter.ReadObject(); field != ""; field = iter.ReadObject() {
		if iter.WhatIsNext() == jsoniter.NilValue {
			iter.Skip()
			continue
		}
		switch field {
		case "kind":
			if !checkAndSkipUnexpectedElement(iter, jsonPath+".kind", lc, jsoniter.StringValue) {
				continue
			}
			kind = iter.ReadString()
		case "spec":
			specPath := jsonPath + ".spec"
			if !checkAndSkipUnexpectedElement(iter, specPath, lc, jsoniter.ObjectValue) {
				continue
			}
			switch kind {
			case "Panel":
				panel = readV2PanelSpec(iter, lookup, specPath, lc)
			case "LibraryPanel":
				panel = readV2LibraryPanelSpec(iter, specPath, lc)
			default:
				iter.Skip()
			}
		default:
			iter.Skip()
		}
	}
	return panel, kind == "Panel" || kind == "LibraryPanel"
}

func readObjectValueGetString(iter *jsoniter.Iterator, key string) (string, bool) {
	if iter.WhatIsNext() != jsoniter.ObjectValue {
		return "", false
	}
	v, _ := iter.Read().(map[string]any)
	if v == nil {
		return "", false
	}
	s, ok := v[key].(string)
	return s, ok
}

func readV2PanelSpec(iter *jsoniter.Iterator, lookup DatasourceLookup, jsonPath string, lc map[string]any) PanelSummaryInfo {
	panel := PanelSummaryInfo{}
	for field := iter.ReadObject(); field != ""; field = iter.ReadObject() {
		if iter.WhatIsNext() == jsoniter.NilValue {
			iter.Skip()
			continue
		}
		switch field {
		case "title":
			if checkAndSkipUnexpectedElement(iter, jsonPath+".title", lc, jsoniter.StringValue) {
				panel.Title = iter.ReadString()
			}
		case "description":
			if checkAndSkipUnexpectedElement(iter, jsonPath+".description", lc, jsoniter.StringValue) {
				panel.Description = iter.ReadString()
			}
		case "vizConfig":
			if iter.WhatIsNext() == jsoniter.ObjectValue {
				if k, ok := readObjectValueGetString(iter, "kind"); ok && k != "" {
					panel.Type = k
				}
			} else {
				iter.Skip()
			}
		case "data":
			if iter.WhatIsNext() == jsoniter.ObjectValue {
				v, _ := iter.Read().(map[string]any)
				if spec, _ := v["spec"].(map[string]any); spec != nil {
					if trans, _ := spec["transformations"].([]any); trans != nil {
						for _, t := range trans {
							if m, ok := t.(map[string]any); ok {
								if id, ok := m["id"].(string); ok {
									panel.Transformer = append(panel.Transformer, id)
								}
							}
						}
					}
					if queries, _ := spec["queries"].([]any); queries != nil {
						for _, q := range queries {
							if m, ok := q.(map[string]any); ok {
								if ds, ok := m["datasource"].(map[string]any); ok {
									uid, _ := ds["uid"].(string)
									typ, _ := ds["type"].(string)
									if uid != "" {
										panel.Datasource = append(panel.Datasource, DataSourceRef{UID: uid, Type: typ})
									}
								}
							}
						}
					}
				}
			} else {
				iter.Skip()
			}
		default:
			iter.Skip()
		}
	}
	panel.Datasource = filterSpecialDatasourcesFromRefs(panel.Datasource)
	return panel
}

func readV2LibraryPanelSpec(iter *jsoniter.Iterator, jsonPath string, lc map[string]any) PanelSummaryInfo {
	panel := PanelSummaryInfo{}
	for field := iter.ReadObject(); field != ""; field = iter.ReadObject() {
		if iter.WhatIsNext() == jsoniter.NilValue {
			iter.Skip()
			continue
		}
		switch field {
		case "title":
			if checkAndSkipUnexpectedElement(iter, jsonPath+".title", lc, jsoniter.StringValue) {
				panel.Title = iter.ReadString()
			}
		case "libraryPanel":
			if iter.WhatIsNext() == jsoniter.ObjectValue {
				if uid, ok := readObjectValueGetString(iter, "uid"); ok {
					panel.LibraryPanel = uid
				}
			} else {
				iter.Skip()
			}
		default:
			iter.Skip()
		}
	}
	return panel
}
