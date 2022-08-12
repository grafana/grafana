package extract

import (
	"io"
	"strconv"

	jsoniter "github.com/json-iterator/go"

	"github.com/grafana/grafana/pkg/services/searchV2/dslookup"
)

// nolint:gocyclo
// ReadDashboard will take a byte stream and return dashboard info
func ReadQuery(stream io.Reader, uid string, lookup dslookup.DatasourceLookup) (*QueryInfo, error) {
	query := &QueryInfo{UID: uid}

	iter := jsoniter.Parse(jsoniter.ConfigDefault, stream, 1024)

	targets := newTargetInfo(lookup)

	for l1Field := iter.ReadObject(); l1Field != ""; l1Field = iter.ReadObject() {
		// Skip null values so we don't need special int handling
		if iter.WhatIsNext() == jsoniter.NilValue {
			iter.Skip()
			continue
		}

		switch l1Field {
		case "title":
			query.Title = iter.ReadString()

		case "description":
			query.Description = iter.ReadString()

		case "schemaVersion":
			switch iter.WhatIsNext() {
			case jsoniter.NumberValue:
				query.SchemaVersion = iter.ReadInt64()
			case jsoniter.StringValue:
				val := iter.ReadString()
				if v, err := strconv.ParseInt(val, 10, 64); err == nil {
					query.SchemaVersion = v
				}
			default:
				iter.Skip()
			}

		case "tags":
			for iter.ReadArray() {
				query.Tags = append(query.Tags, iter.ReadString())
			}

		case "time":
			obj, ok := iter.Read().(map[string]interface{})
			if ok {
				if timeFrom, ok := obj["from"].(string); ok {
					query.TimeFrom = timeFrom
				}
				if timeTo, ok := obj["to"].(string); ok {
					query.TimeTo = timeTo
				}
			}
		case "queries":
			for iter.ReadArray() {
				readQueryInfo(iter, targets)
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

	query.Datasource = targets.GetDatasourceInfo()

	return query, iter.Error
}

func readQueryInfo(iter *jsoniter.Iterator, targets targetInfo) {
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
		case "datasource":
			targets.addDatasource(iter)

		default:
			v := iter.Read()
			logf("[query] support key: %s / %v\n", l1Field, v)
		}
	}
}
