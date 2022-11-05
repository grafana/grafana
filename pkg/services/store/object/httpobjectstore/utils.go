package httpobjectstore

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/store/object"
	"github.com/grafana/grafana/pkg/services/store/router"
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

func resultsToFrame(ctx context.Context, rsp *object.ObjectSearchResponse, router router.ObjectStoreRouter) *data.Frame {
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
	size.Config = &data.FieldConfig{
		Unit: "bytes",
	}
	labels.Name = labelsFrameField
	fields.Name = labelsFrameField
	updatedAt.Name = "updatedAt"
	updatedBy.Name = "updatedBy"

	for i, res := range rsp.Results {
		p := ""

		name.Set(i, res.Name)
		kind.Set(i, res.GRN.Kind)
		if res.GRN.Kind == models.StandardKindFolder {
			p = fmt.Sprintf("%s/%s", res.GRN.Scope, res.GRN.UID)
		} else {
			info, _ := router.Route(ctx, res.GRN)
			idx := strings.Index(info.Key, "/")
			p = info.Key[idx:]
		}
		path.Set(i, p) // only drive for now
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

func asBoolean(key string, vals url.Values, defaultValue bool) bool {
	v, ok := vals[key]
	if !ok {
		return defaultValue
	}
	if len(v) == 0 {
		return true // single boolean parameter
	}
	b, err := strconv.ParseBool(v[0])
	if err != nil {
		return defaultValue
	}
	return b
}

func getMultipartFormValue(req *http.Request, key string) string {
	v, ok := req.MultipartForm.Value[key]
	if !ok || len(v) != 1 {
		return ""
	}
	return v[0]
}
