import { capitalize } from 'lodash';
import { LabelParamEditor } from './components/LabelParamEditor';
import { defaultAddOperationHandler, functionRendererLeft } from './operations';
import { QueryBuilderOperation, QueryBuilderOperationDef } from './shared/types';
import { PromVisualQueryOperationCategory } from './types';

export function getAggregationOperations(): QueryBuilderOperationDef[] {
  return [
    ...createAggregationOperation('sum'),
    ...createAggregationOperation('avg'),
    ...createAggregationOperation('min'),
    ...createAggregationOperation('max'),
    ...createAggregationOperation('count'),
  ];
}

function createAggregationOperation(name: string): QueryBuilderOperationDef[] {
  return [
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
}

function getAggregationByRenderer(aggregation: string) {
  return function aggregationRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
    return `${aggregation} by(${model.params.join(', ')}) (${innerExpr})`;
  };
}

/**
 * This function will transform operations without labels to their plan aggregation operation
 */
function getLastLabelRemovedHandler(changeToOperartionId: string) {
  return function onParamChanged(index: number, op: QueryBuilderOperation) {
    if (op.params.length > 0) {
      return op;
    }

    return {
      ...op,
      id: changeToOperartionId,
    };
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
