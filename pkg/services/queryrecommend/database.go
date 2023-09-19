package queryrecommend

import (
	"context"
	"math/rand"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/querytemplate"
)

// getQueryRecommendation searches recommendation query given provided metrics
func (s QueryRecommendService) findQueryRecommendation(ctx context.Context, datasource string, metric string) ([]QueryRecommendDTO, error) {
	var dtos []QueryRecommendDTO
	err := s.store.WithDbSession(ctx, func(session *db.Session) error {
		dtosBuilder := db.SQLBuilder{}
		dtosBuilder.Write(`SELECT
			query_recommend.metric,
			query_recommend.templated_expr,
			query_recommend.count,
			query_recommend.topLabelValues,
			query_recommend.topLabelNoValues,
			query_recommend.created_at AS created_at,
			query_recommend.queries
			FROM query_recommend
			ORDER BY created_at DESC
		`)

		err := session.SQL(dtosBuilder.GetSQLString(), dtosBuilder.GetParams()...).Find(&dtos)
		return err
	})
	return dtos, err
}

func (s QueryRecommendService) getQueryRecommendation(ctx context.Context, datasource string, metric string, numSuggestions int64) ([]QueryRecommendDTO, error) {
	// dtos, err := s.findQueryRecommendation(ctx, datasource, query)
	// if err != nil {
	// 	s.ComputeQueryRecommendation(ctx, datasource)
	// 	dtos, err = s.findQueryRecommendation(ctx, datasource, query)
	// }

	var dtos = make([]QueryRecommendDTO, numSuggestions)

	suggestionTemplates := querytemplate.CommonTemplateSuggestions

	rand.Shuffle(len(suggestionTemplates), func(i, j int) {
		suggestionTemplates[i], suggestionTemplates[j] = suggestionTemplates[j], suggestionTemplates[i]
	})

	for idx, template := range suggestionTemplates[:numSuggestions] {
		dtos[idx] = QueryRecommendDTO{
			Metric:           metric,
			TemplatedExpr:    template,
			Count:            0,
			TopLabelValues:   nil,
			TopLabelNoValues: nil,
			CreatedAt:        0,
		}
	}
	return dtos, nil
}

func (s QueryRecommendService) computeQueryRecommendation(ctx context.Context, datasource string) error {
	var dtos []QueryHistoryDTO
	err := s.store.WithDbSession(ctx, func(session *db.Session) error {
		dtosBuilder := db.SQLBuilder{}
		dtosBuilder.Write(`SELECT
			query_history.uid,
			query_history.datasource_uid,
			query_history.created_by,
			query_history.created_at AS created_at,
			query_history.comment,
			query_history.queries
			FROM query_history
			ORDER BY created_at DESC
		`)

		err := session.SQL(dtosBuilder.GetSQLString(), dtosBuilder.GetParams()...).Find(&dtos)
		return err
	})
	if err != nil {
		return err
	}

	return err
}
