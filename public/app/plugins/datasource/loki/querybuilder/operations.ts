import { defaultAddOperationHandler, functionRendererLeft } from '../../prometheus/querybuilder/shared/operationUtils';
import {
  QueryBuilderOperation,
  QueryBuilderOperationDef,
  QueryBuilderOperationParamDef,
} from '../../prometheus/querybuilder/shared/types';
import { LokiVisualQueryOperationCategory } from './types';

export function getOperationDefintions(): QueryBuilderOperationDef[] {
  const list: QueryBuilderOperationDef[] = [
    {
      id: 'rate',
      displayName: 'Rate',
      params: [getRangeVectorParamDef()],
      defaultParams: ['auto'],
      category: LokiVisualQueryOperationCategory.Functions,
      renderer: operationWithRangeVectorRenderer,
      onAddToQuery: defaultAddOperationHandler,
    },
    {
      id: 'sum',
      displayName: 'Sum',
      params: [],
      defaultParams: [],
      category: LokiVisualQueryOperationCategory.Aggregations,
      renderer: functionRendererLeft,
      onAddToQuery: defaultAddOperationHandler,
    },
    {
      id: 'json',
      displayName: 'Json',
      params: [],
      defaultParams: [],
      category: LokiVisualQueryOperationCategory.Formats,
      renderer: pipelineRenderer,
      onAddToQuery: defaultAddOperationHandler,
    },
    {
      id: 'logfmt',
      displayName: 'Logfmt',
      params: [],
      defaultParams: [],
      category: LokiVisualQueryOperationCategory.Formats,
      renderer: pipelineRenderer,
      onAddToQuery: defaultAddOperationHandler,
    },
  ];

  return list;
}

function getRangeVectorParamDef(): QueryBuilderOperationParamDef {
  return {
    name: 'Range vector',
    type: 'string',
    options: ['auto', '$__interval', '$__range', '1m', '5m', '10m', '1h', '24h'],
  };
}

function operationWithRangeVectorRenderer(
  model: QueryBuilderOperation,
  def: QueryBuilderOperationDef,
  innerExpr: string
) {
  let rangeVector = (model.params ?? [])[0] ?? 'auto';

  if (rangeVector === 'auto') {
    rangeVector = '$__interval';
  }

  return `${def.id}(${innerExpr}[${rangeVector}])`;
}

function pipelineRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
  return `${innerExpr} | ${model.id}`;
}
