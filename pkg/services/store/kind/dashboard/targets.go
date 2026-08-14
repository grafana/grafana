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

func (s *targetInfo) addPanel(panel PanelSummaryInfo) {
	for idx, v := range panel.Datasource {
		if v.UID != "" {
			s.uids[v.UID] = &panel.Datasource[idx]
		}
	}
}
