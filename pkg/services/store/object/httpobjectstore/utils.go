package httpobjectstore

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/store/object"
)

const (
	nameFrameField        = "name"
	kindFrameField        = "kind"
	pathPathField         = "path" // scope + uid
	descriptionFrameField = "description"
	labelsFrameField      = "labels"
	fieldsFrameField      = "fields"
	sizeFrameField        = "size"
	updatedAtFrameField   = "updatedAt"
	updatedByFrameField   = "updatedBy"
)

func resultsToFrame(rsp *object.ObjectSearchResponse) *data.Frame {
	if rsp == nil {
		return nil
	}
	count := len(rsp.Results)

	name := data.NewFieldFromFieldType(data.FieldTypeString, count)
	kind := data.NewFieldFromFieldType(data.FieldTypeString, count)
	path := data.NewFieldFromFieldType(data.FieldTypeString, count)
	descr := data.NewFieldFromFieldType(data.FieldTypeString, count)
	size := data.NewFieldFromFieldType(data.FieldTypeInt64, count)
	labels := data.NewFieldFromFieldType(data.FieldTypeJSON, count)
	fields := data.NewFieldFromFieldType(data.FieldTypeJSON, count)
	updatedAt := data.NewFieldFromFieldType(data.FieldTypeNullableTime, count)
	updatedBy := data.NewFieldFromFieldType(data.FieldTypeString, count)

	name.Name = nameFrameField
	kind.Name = kindFrameField
	path.Name = pathPathField
	descr.Name = descriptionFrameField
	size.Name = sizeFrameField
	labels.Name = labelsFrameField
	fields.Name = labelsFrameField
	updatedAt.Name = "updatedAt"
	updatedBy.Name = "updatedBy"

	for i, res := range rsp.Results {
		name.Set(i, res.Name)
		kind.Set(i, res.GRN.Kind)
		path.Set(i, fmt.Sprintf("%s/%s", res.GRN.Scope, res.GRN.UID)) // only drive for now
		descr.Set(i, res.Description)

		if res.Labels != nil {
			b, err := json.Marshal(res.Labels)
			if err != nil {
				labels.Set(i, json.RawMessage(b))
			}
		}
		if res.FieldsJson != nil {
			fields.Set(i, json.RawMessage(res.FieldsJson))
		}

		//size.Set(i, res.)

		updatedBy.Set(i, res.UpdatedBy)
		if res.Updated > 0 {
			updatedAt.SetConcrete(i, time.UnixMilli(res.Updated))
		}
	}

	return data.NewFrame("", name, kind, path, descr, size, labels, fields, updatedAt, updatedBy)
}
