package extract

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"

	jsoniter "github.com/json-iterator/go"

	"github.com/grafana/grafana/pkg/services/searchV2/dslookup"
)

type queryInfo struct {
	lookup dslookup.DatasourceLookup

	// panel level ref
	ds *dslookup.DataSourceRef

	// each query
	targets []map[string]interface{}

	// transforms
	transforms []map[string]interface{}
}

type panelQueryInfo struct {
	ds           []dslookup.DataSourceRef
	transformers []string
	hash         string
}

func newQueryInfo(lookup dslookup.DatasourceLookup) queryInfo {
	return queryInfo{
		lookup: lookup,
	}
}

func (s *queryInfo) GetDatasourceInfo() panelQueryInfo {
	hasQuery := false
	info := panelQueryInfo{}
	sha256 := sha256.New()
	byUID := make(map[string]*dslookup.DataSourceRef)
	var ds *dslookup.DataSourceRef

	// add target info
	for _, t := range s.targets {
		v, ok := t["datasource"]
		if ok {
			ds = getDS(v, s.lookup)
		} else {
			ds = s.ds
		}

		// distinct UIDs
		if ds != nil {
			if ds.UID != "" {
				byUID[ds.UID] = ds
			}
			if ds.Type != "" {
				sha256.Write([]byte(ds.Type))
			}
		}

		delete(t, "datasource")
		b, err := json.Marshal(t) // sorts the keys?
		if err == nil {
			sha256.Write(b)
			hasQuery = true
		}
	}

	info.ds = make([]dslookup.DataSourceRef, 0, len(byUID))
	for _, v := range byUID {
		info.ds = append(info.ds, *v)
	}

	// adds the transformer info
	for _, t := range s.transforms {
		id, ok := t["id"]
		if ok {
			v, ok := id.(string)
			if ok {
				info.transformers = append(info.transformers, v)
			}
		}

		b, err := json.Marshal(t) // sorts the keys?
		if err == nil {
			sha256.Write(b)
			hasQuery = true
		}
	}

	if hasQuery {
		info.hash = hex.EncodeToString(sha256.Sum(nil)[:6]) // first few characters
	}
	return info
}

// the node will either be string (name|uid) OR ref
func (s *queryInfo) setDatasource(val interface{}) {
	s.ds = getDS(val, s.lookup)
}

func getDS(val interface{}, lookup dslookup.DatasourceLookup) *dslookup.DataSourceRef {
	if val == nil {
		return lookup.ByRef(nil)
	}

	dsRef := &dslookup.DataSourceRef{}

	switch v := val.(type) {
	case string:
		dsRef.UID = v

	case map[string]interface{}:
		dsRef.UID, _ = v["uid"].(string)
		dsRef.Type, _ = v["type"].(string)

	default:
		logf("[Panel.datasource.unknown.type] %T/%v\n", val, val)
		return nil
	}

	if !isVariableRef(dsRef.UID) && !isSpecialDatasource(dsRef.UID) {
		ds := lookup.ByRef(dsRef)
		if ds != nil {
			return ds
		}
	}

	return dsRef
}

func (s *queryInfo) addTarget(iter *jsoniter.Iterator) {
	v := iter.Read()
	if v == nil {
		return // ignore
	}

	m, ok := v.(map[string]interface{})
	if !ok {
		iter.ReportError("read", "error reading target")
		return
	}

	s.targets = append(s.targets, m)
}

func (s *queryInfo) addTransformer(iter *jsoniter.Iterator) {
	v := iter.Read()
	if v == nil {
		return // ignore
	}

	m, ok := v.(map[string]interface{})
	if !ok {
		iter.ReportError("read", "error reading transform")
		return
	}

	s.transforms = append(s.transforms, m)
}

func getDistinctDatasources(dash *DashboardInfo) []dslookup.DataSourceRef {
	byUID := make(map[string]dslookup.DataSourceRef)
	for _, panel := range dash.Panels {
		for idx, v := range panel.Datasource {
			if v.UID != "" {
				byUID[v.UID] = panel.Datasource[idx]
			}
		}
	}

	res := make([]dslookup.DataSourceRef, 0, len(byUID))
	for _, v := range byUID {
		res = append(res, v)
	}
	return res
}
