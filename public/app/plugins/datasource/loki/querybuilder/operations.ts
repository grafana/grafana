import { defaultAddOperationHandler, functionRendererLeft } from '../../prometheus/querybuilder/shared/operationUtils';
import { QueryBuilderOperation, QueryBuilderOperationDef } from '../../prometheus/querybuilder/shared/types';
import { LokiVisualQueryOperationCategory } from './types';

export function getOperationDefintions(): QueryBuilderOperationDef[] {
  const list: QueryBuilderOperationDef[] = [
    {
      id: 'rate',
      displayName: 'Rate',
      params: [],
      defaultParams: [],
      category: LokiVisualQueryOperationCategory.Functions,
      renderer: functionRendererLeft,
      onAddToQuery: defaultAddOperationHandler,
    },
    {
      id: 'Sum',
      displayName: 'Sum',
      params: [],
      defaultParams: [],
      category: LokiVisualQueryOperationCategory.Aggregations,
      renderer: functionRendererLeft,
      onAddToQuery: defaultAddOperationHandler,
    },
    {
      id: 'json',
      displayName: 'json',
      params: [],
      defaultParams: [],
      category: LokiVisualQueryOperationCategory.Formats,
      renderer: pipelineRenderer,
      onAddToQuery: defaultAddOperationHandler,
    },
    {
      id: 'logfmt',
      displayName: 'json',
      params: [],
      defaultParams: [],
      category: LokiVisualQueryOperationCategory.Formats,
      renderer: pipelineRenderer,
      onAddToQuery: defaultAddOperationHandler,
    },
  ];

  return list;
}

function pipelineRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
  return `${innerExpr} | ${model.id}`;
}
