package object

import (
	"encoding/json"
	"sort"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/store/object"
)

//------------------------------------------------------------------------------
// Currently this is just for testing.
// In general it will flatten objects + summary into differnet tables
//------------------------------------------------------------------------------

type SummaryTable struct {
	Raw        *data.Frame
	Summary    *data.Frame
	References *data.Frame
	Labels     *data.Frame
}

func newSummaryTable() SummaryTable {
	return SummaryTable{
		Raw: data.NewFrame("raw",
			newField("uid", data.FieldTypeString),
			newField("kind", data.FieldTypeString),
			newField("size", data.FieldTypeInt64),
			newField("etag", data.FieldTypeString),
		),
		Summary: data.NewFrame("summary",
			newField("uid", data.FieldTypeString),
			newField("name", data.FieldTypeString),
			newField("fields", data.FieldTypeJSON),
		),
		References: data.NewFrame("references",
			newField("uid", data.FieldTypeString),
			newField("kind", data.FieldTypeString),
			newField("type", data.FieldTypeString),
			newField("uid", data.FieldTypeString), // yes, same key :grimmice:, path_hash?
		),
		Labels: data.NewFrame("labels",
			newField("uid", data.FieldTypeString),
			newField("key", data.FieldTypeString),
			newField("value", data.FieldTypeString),
		),
	}
}

func newField(name string, p data.FieldType) *data.Field {
	f := data.NewFieldFromFieldType(p, 0)
	f.Name = name
	return f
}

func (x *SummaryTable) Add(obj *object.RawObject, summary object.ObjectSummary) {
	x.Raw.AppendRow(
		obj.UID,
		obj.Kind,
		obj.Size,
		obj.ETag,
	)

	// Add summary table
	fieldsJson, _ := json.Marshal(summary.Fields)
	x.Summary.AppendRow(
		obj.UID,
		summary.Name,
		json.RawMessage(fieldsJson),
	)

	// Add references
	for _, ref := range summary.References {
		x.References.AppendRow(
			obj.UID,
			ref.Kind,
			ref.Type,
			ref.UID,
		)
	}

	// Stable sort order
	keys := make([]string, 0, len(summary.Labels))
	for k := range summary.Labels {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		x.Labels.AppendRow(
			obj.UID,
			k,
			summary.Labels[k],
		)
	}
}
