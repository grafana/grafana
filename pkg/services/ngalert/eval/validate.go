package eval

import (
	"fmt"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

type ConditionValidator struct {
	dataSourceCache   datasources.CacheService
	pluginsStore      pluginstore.Store
	expressionService expressionBuilder
}

func NewConditionValidator(datasourceCache datasources.CacheService, expressionService *expr.Service, pluginsStore pluginstore.Store) *ConditionValidator {
	return &ConditionValidator{
		dataSourceCache:   datasourceCache,
		expressionService: expressionService,
		pluginsStore:      pluginsStore,
	}
}

func (e *ConditionValidator) Validate(ctx EvaluationContext, condition models.Condition) error {
	req, err := getExprRequest(ctx, condition, e.dataSourceCache, ctx.AlertingResultsReader)
	if err != nil {
		return err
	}
	for _, query := range req.Queries {
		if query.DataSource == nil {
			continue
		}
		switch expr.NodeTypeFromDatasourceUID(query.DataSource.UID) {
		case expr.TypeDatasourceNode:
			p, found := e.pluginsStore.Plugin(ctx.Ctx, query.DataSource.Type)
			if !found { // technically this should fail earlier during datasource resolution phase.
				return fmt.Errorf("plugin %s could not be found for datasource query refID %s: %w", query.DataSource.Type, query.RefID, plugins.ErrPluginNotRegistered)
			}
			if !p.Backend {
				return fmt.Errorf("datasource refID %s is not a backend datasource", query.RefID)
			}
		case expr.TypeMLNode:
			_, found := e.pluginsStore.Plugin(ctx.Ctx, query.DataSource.Type)
			if !found {
				return fmt.Errorf("plugin %s could not be found for datasource query refID %s: %w", query.DataSource.Type, query.RefID, plugins.ErrPluginNotRegistered)
			}
		case expr.TypeCMDNode:
		}
	}
	pipeline, err := e.expressionService.BuildPipeline(req)
	if err != nil {
		return err
	}
	refIDs := make([]string, 0, len(pipeline))
	for _, node := range pipeline {
		if node.RefID() == condition.Condition {
			return nil
		}
		refIDs = append(refIDs, node.RefID())
	}
	return models.ErrConditionNotExist(condition.Condition, refIDs)
}
