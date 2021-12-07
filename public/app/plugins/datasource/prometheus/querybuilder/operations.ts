import { LabelParamEditor } from './components/LabelParamEditor';
import { promQueryModeller } from './PromQueryModeller';
import { QueryBuilderOperation, QueryBuilderOperationDef, QueryBuilderOperationParamDef } from './shared/types';
import { getDefaultTestQuery, PromVisualQuery, PromVisualQueryOperationCategory } from './types';

export function getOperationDefintions(): QueryBuilderOperationDef[] {
  const list: QueryBuilderOperationDef[] = [
    {
      id: 'sum',
      displayName: 'Sum',
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
      onParamChanged: getOnLabelAdddedHandler('__sum_by'),
    },
    {
      id: 'avg',
      displayName: 'Average',
      params: [],
      defaultParams: [],
      category: PromVisualQueryOperationCategory.Aggregations,
      renderer: functionRendererLeft,
      onAddToQuery: defaultAddOperationHandler,
    },
    {
      id: 'histogram_quantile',
      displayName: 'Histogram quantile',
      params: [{ name: 'Quantile', type: 'number', options: [0.99, 0.95, 0.9, 0.75, 0.5, 0.25] }],
      defaultParams: [0.9],
      category: PromVisualQueryOperationCategory.Functions,
      renderer: functionRendererLeft,
      onAddToQuery: defaultAddOperationHandler,
    },
    {
      id: 'label_replace',
      displayName: 'Label replace',
      params: [
        { name: 'Destination label', type: 'string' },
        { name: 'Replacement', type: 'string' },
        { name: 'Source label', type: 'string' },
        { name: 'Regex', type: 'string' },
      ],
      category: PromVisualQueryOperationCategory.Functions,
      defaultParams: ['', '$1', '', '(.*)'],
      renderer: functionRendererRight,
      onAddToQuery: defaultAddOperationHandler,
    },
    {
      id: '__sum_by',
      displayName: 'Sum by',
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
      renderer: getAggregationByRenderer('sum'),
      onAddToQuery: defaultAddOperationHandler,
      onParamChanged: getLastLabelRemovedHandler('sum'),
    },
    {
      id: '__avg_by',
      displayName: 'Average by',
      params: [{ name: 'Label', type: 'string', restParam: true }],
      defaultParams: [''],
      category: PromVisualQueryOperationCategory.GroupBy,
      renderer: getAggregationByRenderer('avg'),
      onAddToQuery: defaultAddOperationHandler,
    },
    {
      id: 'rate',
      displayName: 'Rate',
      params: [getRangeVectorParamDef()],
      defaultParams: ['auto'],
      category: PromVisualQueryOperationCategory.RateAndDeltas,
      renderer: operationWithRangeVectorRenderer,
      onAddToQuery: addOperationWithRangeVector,
    },
    {
      id: 'increase',
      displayName: 'Increase',
      params: [getRangeVectorParamDef()],
      defaultParams: ['auto'],
      category: PromVisualQueryOperationCategory.RateAndDeltas,
      renderer: operationWithRangeVectorRenderer,
      onAddToQuery: addOperationWithRangeVector,
    },
    // Not sure about this one. It could also be a more generic "Simple math operation" where user specifies
    // both the operator and the operand in a single input
    {
      id: '__multiply_by',
      displayName: 'Multiply by',
      params: [{ name: 'Factor', type: 'number' }],
      defaultParams: [2],
      category: PromVisualQueryOperationCategory.Math,
      renderer: multiplyRenderer,
      onAddToQuery: defaultAddOperationHandler,
    },
    {
      id: '__nested_query',
      displayName: 'Nested query',
      params: [],
      defaultParams: [],
      category: PromVisualQueryOperationCategory.Math,
      renderer: multiplyRenderer,
      onAddToQuery: addNestedQueryHandler,
    },
  ];

  return list;
}

function functionRendererLeft(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
  const params = renderParams(model, def, innerExpr);
  const str = model.id + '(';

  if (innerExpr) {
    params.push(innerExpr);
  }

  return str + params.join(', ') + ')';
}

function functionRendererRight(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
  const params = renderParams(model, def, innerExpr);
  const str = model.id + '(';

  if (innerExpr) {
    params.unshift(innerExpr);
  }

  return str + params.join(', ') + ')';
}

function renderParams(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
  return (model.params ?? []).map((value, index) => {
    const paramDef = def.params[index];
    if (paramDef.type === 'string') {
      return '"' + value + '"';
    }

    return value;
  });
}

function getAggregationByRenderer(aggregation: string) {
  return function aggregationRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
    return `${aggregation} by(${model.params.join(', ')}) (${innerExpr})`;
  };
}

function operationWithRangeVectorRenderer(
  model: QueryBuilderOperation,
  def: QueryBuilderOperationDef,
  innerExpr: string
) {
  let rangeVector = (model.params ?? [])[0] ?? 'auto';

  if (rangeVector === 'auto') {
    rangeVector = '$__rate_interval';
  }

  return `${def.id}(${innerExpr}[${rangeVector}])`;
}

function multiplyRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
  return `${innerExpr} * ${model.params[0]}`;
}

function getRangeVectorParamDef(): QueryBuilderOperationParamDef {
  return {
    name: 'Range vector',
    type: 'string',
    options: ['auto', '$__rate_interval', '$__interval', '$__range', '1m', '5m', '10m', '1h', '24h'],
  };
}

function defaultAddOperationHandler(def: QueryBuilderOperationDef, query: PromVisualQuery) {
  const newOperation: QueryBuilderOperation = {
    id: def.id,
    params: def.defaultParams,
  };

  return {
    ...query,
    operations: [...query.operations, newOperation],
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

/**
 * Since there can only be one operation with range vector this will replace the current one (if one was added )
 */
function addOperationWithRangeVector(def: QueryBuilderOperationDef, query: PromVisualQuery) {
  if (query.operations.length > 0) {
    const firstOp = promQueryModeller.getOperationDef(query.operations[0].id);

    if (firstOp.onAddToQuery === addOperationWithRangeVector) {
      return {
        ...query,
        operations: [
          {
            ...query.operations[0],
            id: def.id,
          },
          ...query.operations.slice(1),
        ],
      };
    }
  }

  const newOperation: QueryBuilderOperation = {
    id: def.id,
    params: def.defaultParams,
  };

  return {
    ...query,
    operations: [newOperation, ...query.operations],
  };
}

function addNestedQueryHandler(def: QueryBuilderOperationDef, query: PromVisualQuery) {
  return {
    ...query,
    nestedQueries: [
      ...(query.binaryQueries ?? []),
      {
        operator: '/',
        query: getDefaultTestQuery(),
      },
    ],
  };
}
