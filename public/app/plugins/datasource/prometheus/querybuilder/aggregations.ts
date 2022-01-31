import pluralize from 'pluralize';
import { LabelParamEditor } from './components/LabelParamEditor';
import { addOperationWithRangeVector } from './operations';
import {
  defaultAddOperationHandler,
  functionRendererLeft,
  getPromAndLokiOperationDisplayName,
} from './shared/operationUtils';
import { QueryBuilderOperation, QueryBuilderOperationDef, QueryBuilderOperationParamDef } from './shared/types';
import { PromVisualQueryOperationCategory } from './types';

export function getAggregationOperations(): QueryBuilderOperationDef[] {
  return [
    ...createAggregationOperation('sum'),
    ...createAggregationOperation('avg'),
    ...createAggregationOperation('min'),
    ...createAggregationOperation('max'),
    ...createAggregationOperation('count'),
    ...createAggregationOperation('topk'),
    createAggregationOverTime('sum'),
    createAggregationOverTime('avg'),
    createAggregationOverTime('min'),
    createAggregationOverTime('max'),
    createAggregationOverTime('count'),
    createAggregationOverTime('last'),
    createAggregationOverTime('present'),
    createAggregationOverTime('stddev'),
    createAggregationOverTime('stdvar'),
  ];
}

function createAggregationOperation(name: string): QueryBuilderOperationDef[] {
  const operations: QueryBuilderOperationDef[] = [
    {
      id: name,
      name: getPromAndLokiOperationDisplayName(name),
      params: [
        {
          name: 'By label',
          type: 'string',
          restParam: true,
          optional: true,
        },
      ],
      defaultParams: [],
      alternativesKey: 'plain aggregations',
      category: PromVisualQueryOperationCategory.Aggregations,
      renderer: functionRendererLeft,
      addOperationHandler: defaultAddOperationHandler,
      paramChangedHandler: getOnLabelAdddedHandler(`__${name}_by`),
    },
    {
      id: `__${name}_by`,
      name: `${getPromAndLokiOperationDisplayName(name)} by`,
      params: [
        {
          name: 'Label',
          type: 'string',
          restParam: true,
          optional: true,
          editor: LabelParamEditor,
        },
      ],
      defaultParams: [''],
      alternativesKey: 'aggregations by',
      category: PromVisualQueryOperationCategory.Aggregations,
      renderer: getAggregationByRenderer(name),
      addOperationHandler: defaultAddOperationHandler,
      paramChangedHandler: getLastLabelRemovedHandler(name),
      explainHandler: getAggregationExplainer(name),
      hideFromList: true,
    },
  ];

  // Handle some special aggregations that have parameters
  if (name === 'topk') {
    const param: QueryBuilderOperationParamDef = {
      name: 'K-value',
      type: 'number',
    };
    operations[0].params.unshift(param);
    operations[1].params.unshift(param);
    operations[0].defaultParams = [5];
    operations[1].defaultParams = [5, ''];
    operations[1].renderer = getAggregationByRendererWithParameter(name);
  }

  return operations;
}

function getAggregationByRenderer(aggregation: string) {
  return function aggregationRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
    return `${aggregation} by(${model.params.join(', ')}) (${innerExpr})`;
  };
}

/**
 * Very simple poc implementation, needs to be modified to support all aggregation operators
 */
function getAggregationExplainer(aggregationName: string) {
  return function aggregationExplainer(model: QueryBuilderOperation) {
    const labels = model.params.map((label) => `\`${label}\``).join(' and ');
    const labelWord = pluralize('label', model.params.length);
    return `Calculates ${aggregationName} over dimensions while preserving ${labelWord} ${labels}.`;
  };
}

function getAggregationByRendererWithParameter(aggregation: string) {
  return function aggregationRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
    const firstParam = model.params[0];
    const restParams = model.params.slice(1);
    return `${aggregation} by(${restParams.join(', ')}) (${firstParam}, ${innerExpr})`;
  };
}

/**
 * This function will transform operations without labels to their plan aggregation operation
 */
function getLastLabelRemovedHandler(changeToOperartionId: string) {
  return function onParamChanged(index: number, op: QueryBuilderOperation, def: QueryBuilderOperationDef) {
    // If definition has more params then is defined there are no optional rest params anymore
    // We then transform this operation into a different one
    if (op.params.length < def.params.length) {
      return {
        ...op,
        id: changeToOperartionId,
      };
    }

    return op;
  };
}

function getOnLabelAdddedHandler(changeToOperartionId: string) {
  return function onParamChanged(index: number, op: QueryBuilderOperation) {
    return {
      ...op,
      id: changeToOperartionId,
    };
  };
}

function createAggregationOverTime(name: string): QueryBuilderOperationDef {
  const functionName = `${name}_over_time`;
  return {
    id: functionName,
    name: getPromAndLokiOperationDisplayName(functionName),
    params: [getAggregationOverTimeRangeVector()],
    defaultParams: ['auto'],
    alternativesKey: 'overtime function',
    category: PromVisualQueryOperationCategory.RangeFunctions,
    renderer: operationWithRangeVectorRenderer,
    addOperationHandler: addOperationWithRangeVector,
  };
}

function getAggregationOverTimeRangeVector(): QueryBuilderOperationParamDef {
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
