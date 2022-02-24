import pluralize from 'pluralize';
import { LabelParamEditor } from './components/LabelParamEditor';
import { addOperationWithRangeVector } from './operations';
import {
  defaultAddOperationHandler,
  functionRendererLeft,
  getPromAndLokiOperationDisplayName,
  getRangeVectorParamDef,
} from './shared/operationUtils';
import { QueryBuilderOperation, QueryBuilderOperationDef, QueryBuilderOperationParamDef } from './shared/types';
import { PromVisualQueryOperationCategory, PromOperationId } from './types';

export function getAggregationOperations(): QueryBuilderOperationDef[] {
  return [
    ...createAggregationOperation(PromOperationId.Sum),
    ...createAggregationOperation(PromOperationId.Avg),
    ...createAggregationOperation(PromOperationId.Min),
    ...createAggregationOperation(PromOperationId.Max),
    ...createAggregationOperation(PromOperationId.Count),
    ...createAggregationOperation(PromOperationId.Topk),
    ...createAggregationOperation(PromOperationId.BottomK),
    createAggregationOverTime(PromOperationId.SumOverTime),
    createAggregationOverTime(PromOperationId.AvgOverTime),
    createAggregationOverTime(PromOperationId.MinOverTime),
    createAggregationOverTime(PromOperationId.MaxOverTime),
    createAggregationOverTime(PromOperationId.CountOverTime),
    createAggregationOverTime(PromOperationId.LastOverTime),
    createAggregationOverTime(PromOperationId.PresentOverTime),
    createAggregationOverTime(PromOperationId.AbsentOverTime),
    createAggregationOverTime(PromOperationId.StddevOverTime),
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
      explainHandler: getAggregationExplainer(name, 'by'),
      hideFromList: true,
    },
    {
      id: `__${name}_without`,
      name: `${getPromAndLokiOperationDisplayName(name)} without`,
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
      renderer: getAggregationWithoutRenderer(name),
      addOperationHandler: defaultAddOperationHandler,
      paramChangedHandler: getLastLabelRemovedHandler(name),
      explainHandler: getAggregationExplainer(name, 'without'),
      hideFromList: true,
    },
  ];

  // Handle some special aggregations that have parameters
  if (name === 'topk' || name === 'bottomk') {
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

function getAggregationWithoutRenderer(aggregation: string) {
  return function aggregationRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
    return `${aggregation} without(${model.params.join(', ')}) (${innerExpr})`;
  };
}

/**
 * Very simple poc implementation, needs to be modified to support all aggregation operators
 */
function getAggregationExplainer(aggregationName: string, mode: 'by' | 'without') {
  return function aggregationExplainer(model: QueryBuilderOperation) {
    const labels = model.params.map((label) => `\`${label}\``).join(' and ');
    const labelWord = pluralize('label', model.params.length);
    if (mode === 'by') {
      return `Calculates ${aggregationName} over dimensions while preserving ${labelWord} ${labels}.`;
    } else {
      return `Calculates ${aggregationName} over the dimensions ${labels}. All other labels are preserved.`;
    }
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
  return {
    id: name,
    name: getPromAndLokiOperationDisplayName(name),
    params: [getRangeVectorParamDef()],
    defaultParams: ['$__interval'],
    alternativesKey: 'overtime function',
    category: PromVisualQueryOperationCategory.RangeFunctions,
    renderer: operationWithRangeVectorRenderer,
    addOperationHandler: addOperationWithRangeVector,
  };
}

function operationWithRangeVectorRenderer(
  model: QueryBuilderOperation,
  def: QueryBuilderOperationDef,
  innerExpr: string
) {
  let rangeVector = (model.params ?? [])[0] ?? '$__interval';
  return `${def.id}(${innerExpr}[${rangeVector}])`;
}
