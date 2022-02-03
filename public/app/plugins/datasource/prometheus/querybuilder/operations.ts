import {
  defaultAddOperationHandler,
  functionRendererLeft,
  functionRendererRight,
  getPromAndLokiOperationDisplayName,
} from './shared/operationUtils';
import {
  QueryBuilderOperation,
  QueryBuilderOperationDef,
  QueryBuilderOperationParamDef,
  VisualQueryModeller,
} from './shared/types';
import { PromVisualQuery, PromVisualQueryOperationCategory } from './types';

export function getOperationDefinitions(): QueryBuilderOperationDef[] {
  const list: QueryBuilderOperationDef[] = [
    {
      id: 'histogram_quantile',
      name: 'Histogram quantile',
      params: [{ name: 'Quantile', type: 'number', options: [0.99, 0.95, 0.9, 0.75, 0.5, 0.25] }],
      defaultParams: [0.9],
      category: PromVisualQueryOperationCategory.Functions,
      renderer: functionRendererLeft,
      addOperationHandler: defaultAddOperationHandler,
    },
    {
      id: 'label_replace',
      name: 'Label replace',
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
      id: 'ln',
      name: 'Ln',
      params: [],
      defaultParams: [],
      category: PromVisualQueryOperationCategory.Functions,
      renderer: functionRendererLeft,
      addOperationHandler: defaultAddOperationHandler,
    },
    createRangeFunction('changes'),
    createRangeFunction('rate'),
    createRangeFunction('irate'),
    createRangeFunction('increase'),
    createRangeFunction('delta'),
    // Not sure about this one. It could also be a more generic "Simple math operation" where user specifies
    // both the operator and the operand in a single input
    {
      id: '__multiply_by',
      name: 'Multiply by scalar',
      params: [{ name: 'Factor', type: 'number' }],
      defaultParams: [2],
      category: PromVisualQueryOperationCategory.BinaryOps,
      renderer: getSimpleBinaryRenderer('*'),
      addOperationHandler: defaultAddOperationHandler,
    },
    {
      id: '__divide_by',
      name: 'Divide by scalar',
      params: [{ name: 'Factor', type: 'number' }],
      defaultParams: [2],
      category: PromVisualQueryOperationCategory.BinaryOps,
      renderer: getSimpleBinaryRenderer('/'),
      addOperationHandler: defaultAddOperationHandler,
    },
    {
      id: '__nested_query',
      name: 'Binary operation with query',
      params: [],
      defaultParams: [],
      category: PromVisualQueryOperationCategory.BinaryOps,
      renderer: (model, def, innerExpr) => innerExpr,
      addOperationHandler: addNestedQueryHandler,
    },
  ];

  return list;
}

function createRangeFunction(name: string): QueryBuilderOperationDef {
  return {
    id: name,
    name: getPromAndLokiOperationDisplayName(name),
    params: [getRangeVectorParamDef()],
    defaultParams: ['auto'],
    alternativesKey: 'range function',
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
  let rangeVector = (model.params ?? [])[0] ?? 'auto';

  if (rangeVector === 'auto') {
    rangeVector = '$__rate_interval';
  }

  return `${def.id}(${innerExpr}[${rangeVector}])`;
}

function getSimpleBinaryRenderer(operator: string) {
  return function binaryRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
    return `${innerExpr} ${operator} ${model.params[0]}`;
  };
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
