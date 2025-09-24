package annotations

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/apps/annotations/pkg/apis/annotations/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/annotations"
)

func toLegacyItem(ctx context.Context, q *v0alpha1.Annotation) (*annotations.Item, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	userId, err := user.GetInternalID()
	if err != nil {
		return nil, err
	}
	item := &annotations.Item{
		OrgID:  user.GetOrgID(),
		UserID: userId,
		Text:   q.Spec.Text,
		Tags:   q.Spec.Tags,
		Epoch:  q.Spec.Time,
	}
	if q.Spec.TimeEnd != nil {
		item.EpochEnd = *q.Spec.TimeEnd
	}
	if q.Spec.Dashboard != nil {
		item.DashboardUID = q.Spec.Dashboard.Name
		if q.Spec.Dashboard.Panel != nil {
			item.PanelID = *q.Spec.Dashboard.Panel
		}
	}
	if q.Spec.Alert != nil {
		if q.Spec.Alert.Id != nil {
			item.AlertID = *q.Spec.Alert.Id
		}
		item.NewState = q.Spec.Alert.NewState
		item.PrevState = q.Spec.Alert.PrevState
		if q.Spec.Alert.Data != nil {
			item.Data = simplejson.NewFromAny(q.Spec.Alert.Data)
		}
	}
	return item, nil
}

func toLegacyItemQuery(ctx context.Context, q *v0alpha1.ItemQuery) (*annotations.ItemQuery, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	query := &annotations.ItemQuery{
		OrgID:        user.GetOrgID(),
		From:         q.From,
		To:           q.To,
		AlertUID:     q.AlertUID,
		DashboardUID: q.DashboardUID,
		Tags:         q.Tags,
		MatchAny:     q.MatchAny,
		Limit:        q.Limit,
		Page:         q.Page,

		SignedInUser: user,
	}

	return query, nil
}

func toAnnotation(dto *annotations.ItemDTO) (v0alpha1.Annotation, error) {
	anno := v0alpha1.Annotation{
		ObjectMeta: v1.ObjectMeta{
			Name: fmt.Sprintf("a%d", dto.ID),
		},
		Spec: v0alpha1.AnnotationSpec{
			Text: dto.Text,
			Time: dto.Time,
			Tags: dto.Tags,
		},
	}

	// The DB sets both time and timeEnd to the same value for region annotations.
	if dto.TimeEnd > 0 && dto.TimeEnd != dto.Time {
		anno.Spec.TimeEnd = ptr.To(dto.TimeEnd)
	}

	meta, err := utils.MetaAccessor(&anno)
	if err != nil {
		return anno, err
	}
	meta.SetDeprecatedInternalID(dto.ID) // nolint:staticcheck

	if dto.Created > 0 {
		anno.CreationTimestamp = v1.NewTime(time.UnixMilli(dto.Created))
	}
	if dto.Updated > 0 && dto.Updated != dto.Created {
		meta.SetUpdatedTimestampMillis(dto.Updated)
	}

	if dto.DashboardUID != nil {
		anno.Spec.Dashboard = &v0alpha1.AnnotationDashboard{
			Name: *dto.DashboardUID,
		}
		if dto.PanelID > 0 {
			anno.Spec.Dashboard.Panel = &dto.PanelID
		}
	}

	var data map[string]any
	if dto.Data != nil {
		data, err = dto.Data.Map()
		if err != nil {
			return anno, fmt.Errorf("failed to convert annotation data: %w", err)
		}
		if len(data) == 0 {
			data = nil
		}
	}

	if dto.AlertID > 0 || dto.AlertName != "" || data != nil {
		anno.Spec.Alert = &v0alpha1.AnnotationAlert{
			Name:      dto.AlertName,
			Data:      data,
			NewState:  dto.NewState,
			PrevState: dto.PrevState,
		}
		if dto.AlertID > 0 {
			anno.Spec.Alert.Id = ptr.To(dto.AlertID)
		}
	}

	return anno, nil
}

func toAnnotationList(dto []*annotations.ItemDTO) (*v0alpha1.AnnotationList, error) {
	items := make([]v0alpha1.Annotation, 0, len(dto))
	for _, d := range dto {
		item, err := toAnnotation(d)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return &v0alpha1.AnnotationList{
		Items: items,
	}, nil
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
		if item.Spec.Time > 0 {
			timeStart.Set(i, time.UnixMilli(item.Spec.Time))
		}
		if item.Spec.TimeEnd != nil && *item.Spec.TimeEnd > 0 {
			timeEnd.SetConcrete(i, time.UnixMilli(*item.Spec.TimeEnd))
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
