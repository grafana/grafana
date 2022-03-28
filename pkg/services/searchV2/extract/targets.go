package extract

import (
	jsoniter "github.com/json-iterator/go"
)

type targetInfo struct {
	lookup DatasourceLookup
	uids   map[string]bool
	types  map[string]bool
}

func newTargetInfo(lookup DatasourceLookup) targetInfo {
	return targetInfo{
		lookup: lookup,
		uids:   make(map[string]bool),
		types:  make(map[string]bool),
	}
}

func (s *targetInfo) GetDatasourceList() []string {
	keys := make([]string, len(s.uids))
	i := 0
	for k := range s.uids {
		keys[i] = k
		i++
	}
	return keys
}

func (s *targetInfo) GetDatasourceTypes() []string {
	keys := make([]string, len(s.types))
	i := 0
	for k := range s.types {
		keys[i] = k
		i++
	}
	return keys
}

// the node will either be string (name|uid) OR ref
func (s *targetInfo) addDatasource(iter *jsoniter.Iterator) {
	switch iter.WhatIsNext() {

	case jsoniter.StringValue:
		key := iter.ReadString()
		ds := s.lookup(&DataSourceRef{UID: key, Name: key})
		if !s.addRef(ds) {
			s.uids[key] = true
		}

	case jsoniter.NilValue:
		s.addRef(s.lookup(nil))
		iter.Skip()

	case jsoniter.ObjectValue:
		ref := &DataSourceRef{}
		iter.ReadVal(ref)
		ds := s.lookup(ref)
		if !s.addRef(ds) && ref.UID != "" {
			s.uids[ref.UID] = true
		}

	default:
		v := iter.Read()
		logf("[Panel.datasource.unknown] %v\n", v)
	}
}

func (s *targetInfo) addRef(ref *DataSourceRef) bool {
	if ref == nil {
		return false
	}
	if ref.UID != "" {
		s.uids[ref.UID] = true
	}
	if ref.Type != "" {
		s.types[ref.Type] = true
	}
	return true
}

func (s *targetInfo) addTarget(iter *jsoniter.Iterator) {
	for l1Field := iter.ReadObject(); l1Field != ""; l1Field = iter.ReadObject() {
		switch l1Field {
		case "datasource":
			s.addDatasource(iter)

		case "refId":
			iter.Skip()

		default:
			v := iter.Read()
			logf("[Panel.TARGET] %s=%v\n", l1Field, v)
		}
	}
}

func (s *targetInfo) addPanel(panel PanelInfo) {
	for _, v := range panel.Datasource {
		s.uids[v] = true
	}
	for _, v := range panel.DatasourceType {
		s.types[v] = true
	}
}
