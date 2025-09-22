package annotations

import (
	"context"
	"fmt"
	"time"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"

	"github.com/grafana/grafana/apps/annotations/pkg/apis/annotations/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/annotations"
)

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
			Text:  dto.Text,
			Epoch: dto.Time,
			Tags:  dto.Tags,
		},
	}

	// The DB sets both time and timeEnd to the same value for region annotations.
	if dto.TimeEnd > 0 && dto.TimeEnd != dto.Time {
		anno.Spec.EpochEnd = ptr.To(dto.TimeEnd)
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
			Name: dto.AlertName,
			Data: data,
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
