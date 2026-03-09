package query

import (
	"context"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	queryV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/dsquerierclient"
	"github.com/grafana/grafana/pkg/services/validations"
)

func (s *ServiceImpl) GetSQLSchemas(ctx context.Context, user identity.Requester, reqDTO dtos.MetricRequest) (queryV0.SQLSchemas, error) {
	//TODO DEdupe code

	parsedReq, err := s.parseMetricRequest(ctx, user, false, reqDTO, false)
	if err != nil {
		return queryV0.SQLSchemas{}, err
	}
	exprReq := expr.Request{
		Queries: []expr.Query{},
	}

	if user != nil { // for passthrough authentication, SSE does not authenticate
		exprReq.User = user
		exprReq.OrgId = user.GetOrgID()
	}

	for _, pq := range parsedReq.getFlattenedQueries() {
		if pq.datasource == nil {
			return nil, ErrMissingDataSourceInfo.Build(errutil.TemplateData{
				Public: map[string]any{
					"RefId": pq.query.RefID,
				},
			})
		}

		exprReq.Queries = append(exprReq.Queries, expr.Query{
			JSON:          pq.query.JSON,
			Interval:      pq.query.Interval,
			RefID:         pq.query.RefID,
			MaxDataPoints: pq.query.MaxDataPoints,
			QueryType:     pq.query.QueryType,
			DataSource:    pq.datasource,
			TimeRange: expr.AbsoluteTimeRange{
				From: pq.query.TimeRange.From,
				To:   pq.query.TimeRange.To,
			},
		})
	}

	return s.expressionService.GetSQLSchemas(ctx, exprReq)
}

func GetSQLSchemas(ctx context.Context, log log.Logger, dscache datasources.CacheService, exprService *expr.Service, reqDTO dtos.MetricRequest, qsDatasourceClientBuilder dsquerierclient.QSDatasourceClientBuilder, headers map[string]string) (queryV0.SQLSchemas, error) {
	s := &ServiceImpl{
		log:                        log,
		dataSourceCache:            dscache,
		expressionService:          exprService,
		dataSourceRequestValidator: validations.ProvideValidator(),
		qsDatasourceClientBuilder:  qsDatasourceClientBuilder,
		headers:                    headers,
		concurrentQueryLimit:       16, // TODO: make it configurable
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	return s.GetSQLSchemas(ctx, user, reqDTO)
}
