package searchV2

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/services/querylibrary"
	"github.com/grafana/grafana/pkg/services/user"
)

// TEMPORARY FILE

func (s *StandardSearchService) searchQueries(ctx context.Context, user *user.SignedInUser, q DashboardQuery) *backend.DataResponse {
	queryText := q.Query
	if queryText == "*" {
		queryText = ""
	}
	queryInfo, err := s.queries.Search(ctx, user, querylibrary.QuerySearchOptions{
		Query:          queryText,
		DatasourceUID:  q.Datasource,
		DatasourceType: q.DatasourceType,
	})
	if err != nil {
		return &backend.DataResponse{Error: err}
	}

	header := &customMeta{
		SortBy: q.Sort,
		Count:  uint64(len(queryInfo)),
	}

	fScore := data.NewFieldFromFieldType(data.FieldTypeFloat64, 0)
	fUID := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fKind := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fPType := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fName := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fURL := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fLocation := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fTags := data.NewFieldFromFieldType(data.FieldTypeNullableJSON, 0)
	fDSUIDs := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
	fExplain := data.NewFieldFromFieldType(data.FieldTypeNullableJSON, 0)

	fScore.Name = "score"
	fUID.Name = "uid"
	fKind.Name = "kind"
	fName.Name = "name"
	fLocation.Name = "location"
	fURL.Name = "url"
	fURL.Config = &data.FieldConfig{
		Links: []data.DataLink{
			{Title: "link", URL: "${__value.text}"},
		},
	}
	fPType.Name = "panel_type"
	fDSUIDs.Name = "ds_uid"
	fTags.Name = "tags"
	fExplain.Name = "explain"

	frame := data.NewFrame("Query results", fKind, fUID, fName, fPType, fURL, fTags, fDSUIDs, fLocation)
	if q.Explain {
		frame.Fields = append(frame.Fields, fScore, fExplain)
	}
	frame.SetMeta(&data.FrameMeta{
		Type:   "search-results",
		Custom: header,
	})

	fieldLen := 0

	for _, q := range queryInfo {
		fKind.Append(string(entityKindQuery))
		fUID.Append(q.UID)
		fPType.Append("")
		fName.Append(q.Title)
		fURL.Append("")
		fLocation.Append("General")

		tags := q.Tags
		if tags == nil {
			tags = make([]string, 0)
		}

		tagsJson := mustJsonRawMessage(tags)
		fTags.Append(&tagsJson)

		dsUids := make([]string, 0)
		for _, dsRef := range q.Datasource {
			dsUids = append(dsUids, dsRef.UID)
		}

		fDSUIDs.Append(mustJsonRawMessage(dsUids))

		// extend fields to match the longest field
		fieldLen++
		for _, f := range frame.Fields {
			if fieldLen > f.Len() {
				f.Extend(fieldLen - f.Len())
			}
		}
	}

	return &backend.DataResponse{
		Frames: data.Frames{frame},
	}
}

func mustJsonRawMessage(arr []string) json.RawMessage {
	js, _ := json.Marshal(arr)
	return js
}
