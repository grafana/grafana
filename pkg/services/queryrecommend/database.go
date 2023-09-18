package queryrecommend

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
)

// getQueryRecommendation searches recommendation query given provided metrics
func (s QueryRecommendService) getQueryRecommendation(ctx context.Context, datasource string, query string) ([]QueryRecommendDTO, error) {
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
			query_recommend.queries,
			FROM query_recommend
			ORDER BY created_at DESC
		`)

		err := session.SQL(dtosBuilder.GetSQLString(), dtosBuilder.GetParams()...).Find(&dtos)
		return err
	})
	return dtos, err
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
			query_history.queries,
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
