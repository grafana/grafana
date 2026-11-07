package dashboard

import (
	jsoniter "github.com/json-iterator/go"
)

type targetInfo struct {
	lookup DatasourceLookup
	uids   map[string]*DataSourceRef
}

func newTargetInfo(lookup DatasourceLookup) targetInfo {
	return targetInfo{
		lookup: lookup,
		uids:   make(map[string]*DataSourceRef),
	}
}

func (s *targetInfo) GetDatasourceInfo() []DataSourceRef {
	keys := make([]DataSourceRef, len(s.uids))
	i := 0
	for _, v := range s.uids {
		keys[i] = *v
		i++
	}
	return keys
}

// the node will either be string (name|uid) OR ref
func (s *targetInfo) addDatasource(iter *jsoniter.Iterator, jsonPath string, lc map[string]any) {
	if !checkAndSkipUnexpectedElement(iter, jsonPath, lc, jsoniter.StringValue, jsoniter.NilValue, jsoniter.ObjectValue) {
		return
	}

	switch iter.WhatIsNext() {
	case jsoniter.StringValue:
		key := iter.ReadString()

		dsRef := &DataSourceRef{UID: key}
		if !isVariableRef(dsRef.UID) && !isSpecialDatasource(dsRef.UID) {
			ds := s.lookup.ByRef(dsRef)
			s.addRef(ds)
		} else {
			s.addRef(dsRef)
		}

	case jsoniter.NilValue:
		s.addRef(s.lookup.ByRef(nil))
		iter.Skip()

	case jsoniter.ObjectValue:
		ref := &DataSourceRef{}
		iter.ReadVal(ref)

		if !isVariableRef(ref.UID) && !isSpecialDatasource(ref.UID) {
			s.addRef(s.lookup.ByRef(ref))
		} else {
			s.addRef(ref)
		}

	default:
		iter.Skip()
	}
}

func (s *targetInfo) addRef(ref *DataSourceRef) {
	if ref != nil && ref.UID != "" {
		s.uids[ref.UID] = ref
	}
}

func (s *targetInfo) addTarget(iter *jsoniter.Iterator, jsonPath string, lc map[string]any) {
	if !checkAndSkipUnexpectedElement(iter, jsonPath, lc, jsoniter.ObjectValue) {
		return
	}

	for f := iter.ReadObject(); f != ""; f = iter.ReadObject() {
		switch f {
		case "datasource":
			s.addDatasource(iter, jsonPath+".datasource", lc)

		case "refId":
			iter.Skip()

		default:
			iter.Skip()
		}
	}
}

// addV2Query records the datasource referenced by a v2 PanelQuery element. A query without a
// datasource reference uses the default datasource, as a v1 target with a null datasource does.
func (s *targetInfo) addV2Query(query map[string]any) {
	ref := v2QueryDatasourceRef(query)
	if ref == nil {
		s.addRef(s.lookup.ByRef(nil))
		return
	}
	if isVariableRef(ref.UID) || isSpecialDatasource(ref.UID) {
		s.addRef(ref)
		return
	}
	s.addRef(s.lookup.ByRef(ref))
}

// v2QueryDatasourceRef reads the datasource reference of a v2 PanelQuery element. v2beta1 and later
// carry the datasource UID in spec.query.datasource.name and the plugin type in spec.query.group;
// v2alpha1 carried a {uid, type} reference in spec.datasource.
func v2QueryDatasourceRef(query map[string]any) *DataSourceRef {
	spec, _ := query["spec"].(map[string]any)
	if spec == nil {
		return nil
	}
	if q, _ := spec["query"].(map[string]any); q != nil {
		if ds, _ := q["datasource"].(map[string]any); ds != nil {
			if uid, _ := ds["name"].(string); uid != "" {
				typ, _ := q["group"].(string)
				return &DataSourceRef{UID: uid, Type: typ}
			}
		}
	}
	if ds, _ := spec["datasource"].(map[string]any); ds != nil {
		if uid, _ := ds["uid"].(string); uid != "" {
			typ, _ := ds["type"].(string)
			return &DataSourceRef{UID: uid, Type: typ}
		}
	}
	return nil
}

func (s *targetInfo) addPanel(panel PanelSummaryInfo) {
	for idx, v := range panel.Datasource {
		if v.UID != "" {
			s.uids[v.UID] = &panel.Datasource[idx]
		}
	}
}
