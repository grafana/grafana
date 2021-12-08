import { functionRendererLeft } from '../../prometheus/querybuilder/shared/operationUtils';
import {
  QueryBuilderOperation,
  QueryBuilderOperationDef,
  QueryBuilderOperationParamDef,
  VisualQueryModeller,
} from '../../prometheus/querybuilder/shared/types';
import { LokiVisualQuery, LokiVisualQueryOperationCategory } from './types';

export function getOperationDefintions(): QueryBuilderOperationDef[] {
  const list: QueryBuilderOperationDef[] = [
    {
      id: 'rate',
      displayName: 'Rate',
      params: [getRangeVectorParamDef()],
      defaultParams: ['auto'],
      category: LokiVisualQueryOperationCategory.Functions,
      renderer: operationWithRangeVectorRenderer,
      addOperationHandler: addLokiOperation,
    },
    {
      id: 'sum',
      displayName: 'Sum',
      params: [],
      defaultParams: [],
      category: LokiVisualQueryOperationCategory.Aggregations,
      renderer: functionRendererLeft,
      addOperationHandler: addLokiOperation,
    },
    {
      id: 'json',
      displayName: 'Json',
      params: [],
      defaultParams: [],
      category: LokiVisualQueryOperationCategory.Formats,
      renderer: pipelineRenderer,
      addOperationHandler: addLokiOperation,
    },
    {
      id: 'logfmt',
      displayName: 'Logfmt',
      params: [],
      defaultParams: [],
      category: LokiVisualQueryOperationCategory.Formats,
      renderer: pipelineRenderer,
      addOperationHandler: addLokiOperation,
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

  return `${def.id}(${innerExpr} [${rangeVector}])`;
}

function pipelineRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
  return `${innerExpr} | ${model.id}`;
}

function isRangeVectorFunction(def: QueryBuilderOperationDef) {
  return def.renderer === operationWithRangeVectorRenderer;
}

function isPipelineOperation(def: QueryBuilderOperationDef) {
  return def.renderer === pipelineRenderer;
}

export function addLokiOperation(
  def: QueryBuilderOperationDef,
  query: LokiVisualQuery,
  modeller: VisualQueryModeller
): LokiVisualQuery {
  const newOperation: QueryBuilderOperation = {
    id: def.id,
    params: def.defaultParams,
  };

  const newOperations = [...query.operations];

  // Adding a normal function
  if (def.renderer === functionRendererLeft) {
    const rangeVectorFunction = newOperations.find((x) => {
      return isRangeVectorFunction(modeller.getOperationDef(x.id));
    });

    if (!rangeVectorFunction) {
      const indexOfLastPipeFunction = newOperations.findIndex((x) => {
        return isPipelineOperation(modeller.getOperationDef(x.id));
      });
      newOperations.splice(indexOfLastPipeFunction + 1, 0, { id: 'rate', params: ['auto'] });
    }
  }

  // Adding a pipeline operation, needs to be added before first function operation
  if (def.renderer === pipelineRenderer) {
    const nonPipelineOpIndex = newOperations.findIndex((x) => {
      return !isPipelineOperation(modeller.getOperationDef(x.id));
    });
    newOperations.splice(nonPipelineOpIndex, 0, newOperation);
  } else {
    newOperations.push(newOperation);
  }

  return {
    ...query,
    operations: newOperations,
  };
}
