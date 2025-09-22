package annotations

import (
	"encoding/json"
	"fmt"
	"net/url"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/apps/annotations/pkg/apis/annotations/v0alpha1"
)

// For testing.
var now = time.Now

func parseQuery(values url.Values) (v0alpha1.ItemQuery, error) {
	query := v0alpha1.ItemQuery{}
	timeRange := gtime.TimeRange{
		From: values.Get("from"),
		To:   values.Get("to"),
		Now:  now(),
	}

	t, err := timeRange.ParseFrom()
	if err != nil {
		return query, apierrors.NewBadRequest(fmt.Sprintf("invalid 'from' time: %s", err.Error()))
	}
	query.From = t.UnixMilli()

	t, err = timeRange.ParseTo()
	if err != nil {
		return query, apierrors.NewBadRequest(fmt.Sprintf("invalid 'to' time: %s", err.Error()))
	}
	query.To = t.UnixMilli()

	query.Tags = values["tags"]
	query.DashboardUID = values.Get("dashboardUID")
	query.AlertUID = values.Get("alertUID")

	return query, nil
}

func toDataFrame(result *v0alpha1.AnnotationList) (*data.Frame, error) {
	size := len(result.Items)

	id := data.NewFieldFromFieldType(data.FieldTypeString, size)
	dashboardUID := data.NewFieldFromFieldType(data.FieldTypeNullableString, size)
	panelId := data.NewFieldFromFieldType(data.FieldTypeNullableInt64, size)
	timeStart := data.NewFieldFromFieldType(data.FieldTypeTime, size)
	timeEnd := data.NewFieldFromFieldType(data.FieldTypeNullableTime, size)
	text := data.NewFieldFromFieldType(data.FieldTypeString, size)
	tags := data.NewFieldFromFieldType(data.FieldTypeNullableJSON, size)
	alertId := data.NewFieldFromFieldType(data.FieldTypeNullableInt64, size)
	newState := data.NewFieldFromFieldType(data.FieldTypeNullableString, size)

	id.Name = "id"
	timeStart.Name = "time"
	timeEnd.Name = "timeEnd"
	text.Name = "text"
	tags.Name = "tags"
	dashboardUID.Name = "dashboardUID"
	panelId.Name = "panelId"
	alertId.Name = "alertId"
	newState.Name = "newState"

	hasDashboard := false
	hasRegion := false
	hasAlert := false

	for i, item := range result.Items {
		id.Set(i, item.Name)
		if item.Spec.Epoch > 0 {
			timeStart.Set(i, time.UnixMilli(item.Spec.Epoch))
		}
		if item.Spec.EpochEnd != nil && *item.Spec.EpochEnd > 0 {
			timeEnd.SetConcrete(i, time.UnixMilli(*item.Spec.EpochEnd))
			hasRegion = true
		}
		if item.Spec.Text != "" {
			text.Set(i, item.Spec.Text)
		}
		if len(item.Spec.Tags) > 0 {
			v, err := json.Marshal(item.Spec.Tags)
			if err != nil {
				return nil, err
			}
			tags.SetConcrete(i, json.RawMessage(v))
		}
		if item.Spec.Dashboard != nil {
			dashboardUID.SetConcrete(i, item.Spec.Dashboard.Name)
			panelId.Set(i, item.Spec.Dashboard.Panel)
			hasDashboard = true
		}
		if item.Spec.Alert != nil {
			alertId.Set(i, item.Spec.Alert.Id)
			if item.Spec.Alert.NewState != "" {
				newState.SetConcrete(i, item.Spec.Alert.NewState)
			}
			hasAlert = true
		}
	}

	frame := data.NewFrame("", id, text, timeStart)
	if hasRegion {
		frame.Fields = append(frame.Fields, timeEnd)
	}
	if hasDashboard {
		frame.Fields = append(frame.Fields, dashboardUID, panelId)
	}
	if hasAlert {
		frame.Fields = append(frame.Fields, alertId, newState)
	}
	frame.Fields = append(frame.Fields, tags)
	return frame, nil
}
