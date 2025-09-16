package dashboard

import (
	"io"
	"strconv"
	"strings"

	jsoniter "github.com/json-iterator/go"
)

func logf(format string, a ...any) {
	//fmt.Printf(format, a...)
}

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
		// some variables use `ds.name` rather `ds.uid`
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
	iter := jsoniter.Parse(jsoniter.ConfigDefault, stream, 1024)
	return readDashboardIter(iter, lookup)
}

// nolint:gocyclo
func readDashboardIter(iter *jsoniter.Iterator, lookup DatasourceLookup) (*DashboardSummaryInfo, error) {
	dash := &DashboardSummaryInfo{}

	datasourceVariablesLookup := newDatasourceVariableLookup(lookup)

	for l1Field := iter.ReadObject(); l1Field != ""; l1Field = iter.ReadObject() {
		// Skip null values so we don't need special int handling
		if iter.WhatIsNext() == jsoniter.NilValue {
			iter.Skip()
			continue
		}

		switch l1Field {
		// k8s metadata wrappers (skip)
		case "metadata", "kind", "apiVersion":
			_ = iter.Read()

		// recursively read the spec as dashboard json
		case "spec":
			return readDashboardIter(iter, lookup)

		case "id":
			dash.ID = iter.ReadInt64()

		case "uid":
			iter.ReadString()

		case "title":
			dash.Title = iter.ReadString()

		case "description":
			dash.Description = iter.ReadString()

		case "schemaVersion":
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
			dash.TimeZone = iter.ReadString()

		case "editable":
			dash.ReadOnly = !iter.ReadBool()

		case "refresh":
			nxt := iter.WhatIsNext()
			if nxt == jsoniter.StringValue {
				dash.Refresh = iter.ReadString()
			} else {
				iter.Skip()
			}

		case "tags":
			for iter.ReadArray() {
				dash.Tags = append(dash.Tags, iter.ReadString())
			}

		case "links":
			for iter.ReadArray() {
				iter.Skip()
				dash.LinkCount++
			}

		case "time":
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
			for iter.ReadArray() {
				dash.Panels = append(dash.Panels, readpanelInfo(iter, lookup))
			}

		case "rows":
			for iter.ReadArray() {
				v := iter.Read()
				logf("[DASHBOARD.ROW???] id=%s // %v\n", dash.ID, v)
			}

		case "annotations":
			switch iter.WhatIsNext() {
			case jsoniter.ArrayValue:
				// dashboards v2 is an array
				for iter.ReadArray() {
					v := iter.Read()
					logf("[dash.anno] %v\n", v)
				}
			case jsoniter.ObjectValue:
				// dashboards v0/v1 are an object
				for sub := iter.ReadObject(); sub != ""; sub = iter.ReadObject() {
					if sub == "list" {
						for iter.ReadArray() {
							v := iter.Read()
							logf("[dash.anno] %v\n", v)
						}
					} else {
						iter.Skip()
					}
				}
			default:
				iter.Skip()
			}

		case "templating":
			for sub := iter.ReadObject(); sub != ""; sub = iter.ReadObject() {
				if sub == "list" {
					for iter.ReadArray() {
						templateVariable := templateVariable{}

						for k := iter.ReadObject(); k != ""; k = iter.ReadObject() {
							switch k {
							case "name":
								name := iter.ReadString()
								dash.TemplateVars = append(dash.TemplateVars, name)
								templateVariable.name = name
							case "type":
								templateVariable.variableType = iter.ReadString()
							case "query":
								templateVariable.query = iter.Read()
							case "current":
								for c := iter.ReadObject(); c != ""; c = iter.ReadObject() {
									if c == "value" {
										templateVariable.current.value = iter.Read()
									} else {
										iter.Skip()
									}
								}
							default:
								iter.Skip()
							}
						}

						if templateVariable.variableType == "datasource" {
							datasourceVariablesLookup.add(templateVariable)
						}
					}
				} else {
					iter.Skip()
				}
			}

		// Ignore these properties
		case "timepicker":
			fallthrough
		case "version":
			fallthrough
		case "iteration":
			iter.Skip()

		default:
			v := iter.Read()
			logf("[DASHBOARD] support key: %s / %v\n", l1Field, v)
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
	for i, panel := range dash.Panels {
		var dsRefs []DataSourceRef

		// partition into actual datasource references and variables
		for _, ds := range panel.Datasource {
			switch ds.UID {
			case "-- Mixed --":
				// The actual datasources used as targets will remain
				continue
			case "-- Dashboard --":
				// The `Dashboard` datasource refers to the results of the query used in another panel
				continue
			default:
				dsRefs = append(dsRefs, ds)
			}
		}

		dash.Panels[i].Datasource = dsRefs
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

func isSpecialDatasource(uid string) bool {
	return uid == "-- Mixed --" || uid == "-- Dashboard --"
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
	var referencedDs []DataSourceRef
	for _, dsVariableRef := range dsVariableRefs {
		variableName := getDataSourceVariableName(dsVariableRef)
		refs := datasourceVariablesLookup.getDatasourceRefs(variableName)
		referencedDs = append(referencedDs, refs...)
	}
	return referencedDs
}

// will always return strings for now
func readpanelInfo(iter *jsoniter.Iterator, lookup DatasourceLookup) PanelSummaryInfo {
	panel := PanelSummaryInfo{}

	targets := newTargetInfo(lookup)

	for l1Field := iter.ReadObject(); l1Field != ""; l1Field = iter.ReadObject() {
		if iter.WhatIsNext() == jsoniter.NilValue {
			if l1Field == "datasource" {
				targets.addDatasource(iter)
				continue
			}

			// Skip null values so we don't need special int handling
			iter.Skip()
			continue
		}

		switch l1Field {
		case "id":
			panel.ID = iter.ReadInt64()

		case "type":
			panel.Type = iter.ReadString()

		case "title":
			panel.Title = iter.ReadString()

		case "description":
			panel.Description = iter.ReadString()

		case "pluginVersion":
			panel.PluginVersion = iter.ReadString() // since 7x (the saved version for the plugin model)

		case "libraryPanel":
			var v map[string]interface{}
			iter.ReadVal(&v)
			if uid, ok := v["uid"]; ok {
				if u, isString := uid.(string); isString {
					panel.LibraryPanel = u
				}
			}

		case "datasource":
			targets.addDatasource(iter)

		case "targets":
			switch iter.WhatIsNext() {
			case jsoniter.ArrayValue:
				for iter.ReadArray() {
					targets.addTarget(iter)
				}
			case jsoniter.ObjectValue:
				for f := iter.ReadObject(); f != ""; f = iter.ReadObject() {
					targets.addTarget(iter)
				}
			default:
				iter.Skip()
			}

		case "transformations":
			for iter.ReadArray() {
				for sub := iter.ReadObject(); sub != ""; sub = iter.ReadObject() {
					if sub == "id" {
						panel.Transformer = append(panel.Transformer, iter.ReadString())
					} else {
						iter.Skip()
					}
				}
			}

		// Rows have nested panels
		case "panels":
			for iter.ReadArray() {
				panel.Collapsed = append(panel.Collapsed, readpanelInfo(iter, lookup))
			}

		case "options":
			fallthrough

		case "gridPos":
			fallthrough

		case "fieldConfig":
			iter.Skip()

		default:
			v := iter.Read()
			logf("[PANEL] support key: %s / %v\n", l1Field, v)
		}
	}

	panel.Datasource = targets.GetDatasourceInfo()

	return panel
}
