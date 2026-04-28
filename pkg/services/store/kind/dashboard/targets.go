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

// addDatasource accumulates the datasource reference into targetInfo and
// returns the resolved ref (may be nil). The node may be a string (uid),
// nil (default), or an object ref.
func (s *targetInfo) addDatasource(iter *jsoniter.Iterator, jsonPath string, lc map[string]any) *DataSourceRef {
	if !checkAndSkipUnexpectedElement(iter, jsonPath, lc, jsoniter.StringValue, jsoniter.NilValue, jsoniter.ObjectValue) {
		return nil
	}

	switch iter.WhatIsNext() {
	case jsoniter.StringValue:
		key := iter.ReadString()

		dsRef := &DataSourceRef{UID: key}
		if !isVariableRef(dsRef.UID) && !isSpecialDatasource(dsRef.UID) {
			ds := s.lookup.ByRef(dsRef)
			s.addRef(ds)
			return ds
		}
		s.addRef(dsRef)
		return dsRef

	case jsoniter.NilValue:
		ds := s.lookup.ByRef(nil)
		s.addRef(ds)
		iter.Skip()
		return ds

	case jsoniter.ObjectValue:
		ref := &DataSourceRef{}
		iter.ReadVal(ref)

		if !isVariableRef(ref.UID) && !isSpecialDatasource(ref.UID) {
			resolved := s.lookup.ByRef(ref)
			s.addRef(resolved)
			return resolved
		}
		s.addRef(ref)
		return ref

	default:
		iter.Skip()
		return nil
	}
}

func (s *targetInfo) addRef(ref *DataSourceRef) {
	if ref != nil && ref.UID != "" {
		s.uids[ref.UID] = ref
	}
}

// addTarget walks one target object, accumulates its datasource into
// targetInfo, and returns the captured query info. Empty Expression means
// the target had no expression we recognise.
func (s *targetInfo) addTarget(iter *jsoniter.Iterator, jsonPath string, lc map[string]any) PanelQueryInfo {
	var q PanelQueryInfo
	if !checkAndSkipUnexpectedElement(iter, jsonPath, lc, jsoniter.ObjectValue) {
		return q
	}

	for f := iter.ReadObject(); f != ""; f = iter.ReadObject() {
		switch f {
		case "datasource":
			// Null targets resolve to the org default at runtime in this
			// codebase's interpretation, and the panel-level aggregation
			// records that dependency via addDatasource. Don't propagate
			// the resolved default into q.DatasourceUID though — leaving
			// it empty signals "no explicit per-query datasource", and
			// consumers should not assume a single fallback.
			isNil := iter.WhatIsNext() == jsoniter.NilValue
			ref := s.addDatasource(iter, jsonPath+".datasource", lc)
			if !isNil && ref != nil && ref.UID != "" {
				q.DatasourceUID = ref.UID
			}

		case "refId":
			if iter.WhatIsNext() == jsoniter.StringValue {
				q.RefID = iter.ReadString()
			} else {
				iter.Skip()
			}

		case "expr":
			if iter.WhatIsNext() == jsoniter.StringValue && q.Expression == "" {
				q.Expression = iter.ReadString()
			} else {
				iter.Skip()
			}

		case "rawSql", "rawQuery":
			if iter.WhatIsNext() == jsoniter.StringValue && q.Expression == "" {
				q.Expression = iter.ReadString()
			} else {
				iter.Skip()
			}

		case "query":
			// TraceQL: only treat the string form as an expression. The
			// object form appears in templating-variable contexts.
			if iter.WhatIsNext() == jsoniter.StringValue && q.Expression == "" {
				q.Expression = iter.ReadString()
			} else {
				iter.Skip()
			}

		default:
			iter.Skip()
		}
	}
	return q
}

func (s *targetInfo) addPanel(panel PanelSummaryInfo) {
	for idx, v := range panel.Datasource {
		if v.UID != "" {
			s.uids[v.UID] = &panel.Datasource[idx]
		}
	}
}
