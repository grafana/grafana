import { visualQueryEngine } from './engine';
import {
  getDefaultTestQuery,
  PromVisualQuery,
  PromVisualQueryOperation,
  PromVisualQueryOperationCategory,
  PromVisualQueryOperationDef,
  PromVisualQueryOperationParamDef,
} from './types';

export function getOperationDefintions(): PromVisualQueryOperationDef[] {
  const list: PromVisualQueryOperationDef[] = [
    {
      id: 'sum',
      params: [],
      defaultParams: [],
      category: PromVisualQueryOperationCategory.Aggregations,
      renderer: functionRendererLeft,
      addHandler: defaultAddOperationHandler,
    },
    {
      id: 'avg',
      params: [],
      defaultParams: [],
      category: PromVisualQueryOperationCategory.Aggregations,
      renderer: functionRendererLeft,
      addHandler: defaultAddOperationHandler,
    },
    {
      id: 'histogram_quantile',
      displayName: 'Histogram quantile',
      params: [{ name: 'Quantile', type: 'number', options: [0.99, 0.95, 0.9, 0.75, 0.5, 0.25] }],
      defaultParams: [0.9],
      category: PromVisualQueryOperationCategory.Functions,
      renderer: functionRendererLeft,
      addHandler: defaultAddOperationHandler,
    },
    {
      id: 'label_replace',
      params: [
        { name: 'Destination label', type: 'string' },
        { name: 'Replacement', type: 'string' },
        { name: 'Source label', type: 'string' },
        { name: 'Regex', type: 'string' },
      ],
      category: PromVisualQueryOperationCategory.Functions,
      defaultParams: [],
      renderer: functionRendererRight,
      addHandler: defaultAddOperationHandler,
    },
    {
      // Because this is not a real function I prefix it with __ so it wont conflict if Prometheus ever adds a function named group_by
      id: '__group_by',
      displayName: 'Group by',
      params: [
        { name: 'Aggregation', type: 'string' },
        { name: 'Label', type: 'string', restParam: true },
      ],
      defaultParams: ['sum'],
      category: PromVisualQueryOperationCategory.GroupBy,
      renderer: groupByRenderer,
      addHandler: defaultAddOperationHandler,
    },
    {
      id: 'rate',
      displayName: 'Rate',
      params: [getRangeVectorParamDef()],
      defaultParams: ['auto'],
      hasRangeVector: true,
      category: PromVisualQueryOperationCategory.RateAndDeltas,
      renderer: operationWithRangeVectorRenderer,
      addHandler: addOperationWithRangeVector,
    },
    {
      id: 'increase',
      displayName: 'Increase',
      params: [getRangeVectorParamDef()],
      defaultParams: ['auto'],
      hasRangeVector: true,
      category: PromVisualQueryOperationCategory.RateAndDeltas,
      renderer: operationWithRangeVectorRenderer,
      addHandler: addOperationWithRangeVector,
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
      addHandler: defaultAddOperationHandler,
    },
    {
      id: '__divide_by_sub_query',
      displayName: 'Divide by sub query',
      params: [],
      defaultParams: [],
      category: PromVisualQueryOperationCategory.Math,
      renderer: multiplyRenderer,
      addHandler: addNestedQueryHandler,
    },
  ];

  return list;
}

function functionRendererLeft(model: PromVisualQueryOperation, def: PromVisualQueryOperationDef, innerExpr: string) {
  const params = renderParams(model, def, innerExpr);
  const str = model.id + '(';

  if (innerExpr) {
    params.push(innerExpr);
  }

  return str + params.join(', ') + ')';
}

function functionRendererRight(model: PromVisualQueryOperation, def: PromVisualQueryOperationDef, innerExpr: string) {
  const params = renderParams(model, def, innerExpr);
  const str = model.id + '(';

  if (innerExpr) {
    params.unshift(innerExpr);
  }

  return str + params.join(', ') + ')';
}

function renderParams(model: PromVisualQueryOperation, def: PromVisualQueryOperationDef, innerExpr: string) {
  return (model.params ?? []).map((value, index) => {
    const paramDef = def.params[index];
    if (paramDef.type === 'string') {
      return '"' + value + '"';
    }

    return value;
  });
}

function groupByRenderer(model: PromVisualQueryOperation, def: PromVisualQueryOperationDef, innerExpr: string) {
  if (!model.params || model.params.length < 2) {
    throw Error('Params missing on group by');
  }

  // First param is the aggregation, the rest are labels
  let expr = `${model.params[0]} by(`;

  for (let i = 1; i < model.params.length; i++) {
    if (i > 1) {
      expr += ', ';
    }

    expr += model.params[i];
  }

  return `${expr}) (${innerExpr})`;
}

function operationWithRangeVectorRenderer(
  model: PromVisualQueryOperation,
  def: PromVisualQueryOperationDef,
  innerExpr: string
) {
  let rangeVector = (model.params ?? [])[0] ?? 'auto';

  if (rangeVector === 'auto') {
    rangeVector = '$__rate_interval';
  }

  return `${def.id}(${innerExpr}[${rangeVector}])`;
}

function multiplyRenderer(model: PromVisualQueryOperation, def: PromVisualQueryOperationDef, innerExpr: string) {
  return `${innerExpr} * ${model.params[0]}`;
}

function getRangeVectorParamDef(): PromVisualQueryOperationParamDef {
  return {
    name: 'Range vector',
    type: 'string',
    options: ['auto', '$__rate_interval', '$__interval', '1m', '5m', '10m', '1h', '24h'],
  };
}

function defaultAddOperationHandler(def: PromVisualQueryOperationDef, query: PromVisualQuery) {
  const newOperation: PromVisualQueryOperation = {
    id: def.id,
    params: def.defaultParams,
  };

  return {
    ...query,
    operations: [...query.operations, newOperation],
  };
}

/**
 * Since there can only be one operation with range vector this will replace the current one (if one was added )
 */
function addOperationWithRangeVector(def: PromVisualQueryOperationDef, query: PromVisualQuery) {
  if (query.operations.length > 0) {
    const firstOp = visualQueryEngine.getOperationDef(query.operations[0].id);

    if (firstOp.hasRangeVector) {
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

  const newOperation: PromVisualQueryOperation = {
    id: def.id,
    params: def.defaultParams,
  };

  return {
    ...query,
    operations: [newOperation, ...query.operations],
  };
}

function addNestedQueryHandler(def: PromVisualQueryOperationDef, query: PromVisualQuery) {
  return {
    ...query,
    nestedQueries: [
      ...(query.nestedQueries ?? []),
      {
        operator: '/',
        query: getDefaultTestQuery(),
      },
    ],
  };
}
