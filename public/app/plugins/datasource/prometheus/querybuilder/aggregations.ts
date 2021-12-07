import { capitalize } from 'lodash';
import { LabelParamEditor } from './components/LabelParamEditor';
import { defaultAddOperationHandler, functionRendererLeft } from './operations';
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
  ];
}

function createAggregationOperation(name: string): QueryBuilderOperationDef[] {
  const operations: QueryBuilderOperationDef[] = [
    {
      id: name,
      displayName: capitalize(name),
      params: [
        {
          name: 'Label',
          type: 'string',
          restParam: true,
          optional: true,
        },
      ],
      defaultParams: [],
      category: PromVisualQueryOperationCategory.Aggregations,
      renderer: functionRendererLeft,
      onAddToQuery: defaultAddOperationHandler,
      onParamChanged: getOnLabelAdddedHandler(`__${name}_by`),
    },
    {
      id: `__${name}_by`,
      displayName: `${capitalize(name)} by`,
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
      category: PromVisualQueryOperationCategory.GroupBy,
      renderer: getAggregationByRenderer(name),
      onAddToQuery: defaultAddOperationHandler,
      onParamChanged: getLastLabelRemovedHandler(name),
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

function getOnLabelAdddedHandler(cahgneToOperationId: string) {
  return function onParamChanged(index: number, op: QueryBuilderOperation) {
    return {
      ...op,
      id: cahgneToOperationId,
    };
  };
}
