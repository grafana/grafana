package builders

import (
	"context"
	"strconv"

	qhv0alpha1 "github.com/grafana/grafana/apps/queryhistory/pkg/apis/queryhistory/v0alpha1"
	queryhistoryapp "github.com/grafana/grafana/apps/queryhistory/pkg/app"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	QH_COMMENT        = "comment"
	QH_DATASOURCE_UID = "datasource_uid"
	QH_CREATED_BY     = "created_by"
	QH_STAR_COUNT     = "star_count"
)

var QueryHistoryTableColumnDefinitions = map[string]*resourcepb.ResourceTableColumnDefinition{
	QH_COMMENT: {
		Name:        QH_COMMENT,
		Type:        resourcepb.ResourceTableColumnDefinition_STRING,
		Description: "User comment on the query",
		Properties: &resourcepb.ResourceTableColumnDefinition_Properties{
			FreeText: true,
		},
	},
	QH_DATASOURCE_UID: {
		Name:        QH_DATASOURCE_UID,
		Type:        resourcepb.ResourceTableColumnDefinition_STRING,
		Description: "Primary datasource UID",
		Properties: &resourcepb.ResourceTableColumnDefinition_Properties{
			Filterable: true,
		},
	},
	QH_CREATED_BY: {
		Name:        QH_CREATED_BY,
		Type:        resourcepb.ResourceTableColumnDefinition_STRING,
		Description: "User UID who created this query",
		Properties: &resourcepb.ResourceTableColumnDefinition_Properties{
			Filterable: true,
		},
	},
	QH_STAR_COUNT: {
		Name:        QH_STAR_COUNT,
		Type:        resourcepb.ResourceTableColumnDefinition_INT64,
		Description: "Number of stars on this query history item",
		Properties: &resourcepb.ResourceTableColumnDefinition_Properties{
			Filterable: true,
		},
	},
}

func GetQueryHistoryBuilder() (resource.DocumentBuilderInfo, error) {
	values := make([]*resourcepb.ResourceTableColumnDefinition, 0, len(QueryHistoryTableColumnDefinitions))
	for _, v := range QueryHistoryTableColumnDefinitions {
		values = append(values, v)
	}
	fields, err := resource.NewSearchableDocumentFields(values)
	return resource.DocumentBuilderInfo{
		GroupResource: qhv0alpha1.QueryHistoryResourceInfo.GroupResource(),
		Fields:        fields,
		Builder:       new(queryHistoryDocumentBuilder),
	}, err
}

var _ resource.DocumentBuilder = new(queryHistoryDocumentBuilder)

type queryHistoryDocumentBuilder struct{}

func (b *queryHistoryDocumentBuilder) BuildDocument(ctx context.Context, key *resourcepb.ResourceKey, rv int64, value []byte) (*resource.IndexableDocument, error) {
	qh := &qhv0alpha1.QueryHistory{}
	doc, err := NewIndexableDocumentFromValue(key, rv, value, qh, qhv0alpha1.QueryHistoryKind())
	if err != nil {
		return nil, err
	}

	if qh.Spec.Comment != nil {
		doc.Fields[QH_COMMENT] = *qh.Spec.Comment
	}
	doc.Fields[QH_DATASOURCE_UID] = qh.Spec.DatasourceUid

	if labels := qh.GetLabels(); labels != nil {
		if createdBy, ok := labels[queryhistoryapp.LabelCreatedBy]; ok {
			doc.Fields[QH_CREATED_BY] = createdBy
		}
		if starCount, ok := labels[queryhistoryapp.LabelStarCount]; ok {
			if n, err := strconv.ParseInt(starCount, 10, 64); err == nil {
				doc.Fields[QH_STAR_COUNT] = n
			}
		}
	}

	return doc, nil
}
