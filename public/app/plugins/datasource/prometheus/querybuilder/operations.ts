import { defaultAddOperationHandler, functionRendererLeft, functionRendererRight } from './shared/operationUtils';
import {
  QueryBuilderOperation,
  QueryBuilderOperationDef,
  QueryBuilderOperationParamDef,
  VisualQueryModeller,
} from './shared/types';
import { PromVisualQuery, PromVisualQueryOperationCategory } from './types';

export function getOperationDefintions(): QueryBuilderOperationDef[] {
  const list: QueryBuilderOperationDef[] = [
    {
      id: 'histogram_quantile',
      displayName: 'Histogram quantile',
      params: [{ name: 'Quantile', type: 'number', options: [0.99, 0.95, 0.9, 0.75, 0.5, 0.25] }],
      defaultParams: [0.9],
      category: PromVisualQueryOperationCategory.Functions,
      renderer: functionRendererLeft,
      addOperationHandler: defaultAddOperationHandler,
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
      addOperationHandler: defaultAddOperationHandler,
    },
    {
      id: 'rate',
      displayName: 'Rate',
      params: [getRangeVectorParamDef()],
      defaultParams: ['auto'],
      category: PromVisualQueryOperationCategory.RateAndDeltas,
      renderer: operationWithRangeVectorRenderer,
      addOperationHandler: addOperationWithRangeVector,
    },
    {
      id: 'increase',
      displayName: 'Increase',
      params: [getRangeVectorParamDef()],
      defaultParams: ['auto'],
      category: PromVisualQueryOperationCategory.RateAndDeltas,
      renderer: operationWithRangeVectorRenderer,
      addOperationHandler: addOperationWithRangeVector,
    },
    {
      id: 'increase',
      displayName: 'Increase',
      params: [getRangeVectorParamDef()],
      defaultParams: ['auto'],
      category: PromVisualQueryOperationCategory.RateAndDeltas,
      renderer: operationWithRangeVectorRenderer,
      addOperationHandler: addOperationWithRangeVector,
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
      addOperationHandler: defaultAddOperationHandler,
    },
    {
      id: '__nested_query',
      displayName: 'Binary operation with query',
      params: [],
      defaultParams: [],
      category: PromVisualQueryOperationCategory.Math,
      renderer: multiplyRenderer,
      addOperationHandler: addNestedQueryHandler,
    },
  ];

  return list;
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

/**
 * Since there can only be one operation with range vector this will replace the current one (if one was added )
 */
export function addOperationWithRangeVector(
  def: QueryBuilderOperationDef,
  query: PromVisualQuery,
  modeller: VisualQueryModeller
) {
  if (query.operations.length > 0) {
    const firstOp = modeller.getOperationDef(query.operations[0].id);

    if (firstOp.addOperationHandler === addOperationWithRangeVector) {
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

function addNestedQueryHandler(def: QueryBuilderOperationDef, query: PromVisualQuery): PromVisualQuery {
  return {
    ...query,
    binaryQueries: [
      ...(query.binaryQueries ?? []),
      {
        operator: '/',
        query,
      },
    ],
  };
}
