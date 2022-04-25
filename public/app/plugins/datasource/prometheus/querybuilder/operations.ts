import { binaryScalarOperations } from './binaryScalarOperations';
import { LabelParamEditor } from './components/LabelParamEditor';
import {
  defaultAddOperationHandler,
  functionRendererLeft,
  functionRendererRight,
  getPromAndLokiOperationDisplayName,
  getRangeVectorParamDef,
  rangeRendererLeftWithParams,
  rangeRendererRightWithParams,
} from './shared/operationUtils';
import {
  QueryBuilderOperation,
  QueryBuilderOperationDef,
  QueryWithOperations,
  VisualQueryModeller,
} from './shared/types';
import { PromOperationId, PromVisualQuery, PromVisualQueryOperationCategory } from './types';

export function getOperationDefinitions(): QueryBuilderOperationDef[] {
  const list: QueryBuilderOperationDef[] = [
    {
      id: PromOperationId.HistogramQuantile,
      name: 'Histogram quantile',
      params: [{ name: 'Quantile', type: 'number', options: [0.99, 0.95, 0.9, 0.75, 0.5, 0.25] }],
      defaultParams: [0.9],
      category: PromVisualQueryOperationCategory.Functions,
      renderer: functionRendererLeft,
      addOperationHandler: defaultAddOperationHandler,
    },
    {
      id: PromOperationId.LabelReplace,
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
      id: PromOperationId.Ln,
      name: 'Ln',
      params: [],
      defaultParams: [],
      category: PromVisualQueryOperationCategory.Functions,
      renderer: functionRendererLeft,
      addOperationHandler: defaultAddOperationHandler,
    },
    createRangeFunction(PromOperationId.Changes),
    createRangeFunction(PromOperationId.Rate, true),
    createRangeFunction(PromOperationId.Irate),
    createRangeFunction(PromOperationId.Increase, true),
    createRangeFunction(PromOperationId.Idelta),
    createRangeFunction(PromOperationId.Delta),
    createFunction({
      id: PromOperationId.HoltWinters,
      params: [
        getRangeVectorParamDef(),
        { name: 'Smoothing Factor', type: 'number' },
        { name: 'Trend Factor', type: 'number' },
      ],
      defaultParams: ['$__interval', 0.5, 0.5],
      alternativesKey: 'range function',
      category: PromVisualQueryOperationCategory.RangeFunctions,
      renderer: rangeRendererRightWithParams,
      addOperationHandler: addOperationWithRangeVector,
      changeTypeHandler: operationTypeChangedHandlerForRangeFunction,
    }),
    createFunction({
      id: PromOperationId.PredictLinear,
      params: [getRangeVectorParamDef(), { name: 'Seconds from now', type: 'number' }],
      defaultParams: ['$__interval', 60],
      alternativesKey: 'range function',
      category: PromVisualQueryOperationCategory.RangeFunctions,
      renderer: rangeRendererRightWithParams,
      addOperationHandler: addOperationWithRangeVector,
      changeTypeHandler: operationTypeChangedHandlerForRangeFunction,
    }),
    createFunction({
      id: PromOperationId.QuantileOverTime,
      params: [getRangeVectorParamDef(), { name: 'Quantile', type: 'number' }],
      defaultParams: ['$__interval', 0.5],
      alternativesKey: 'overtime function',
      category: PromVisualQueryOperationCategory.RangeFunctions,
      renderer: rangeRendererLeftWithParams,
      addOperationHandler: addOperationWithRangeVector,
      changeTypeHandler: operationTypeChangedHandlerForRangeFunction,
    }),
    ...binaryScalarOperations,
    {
      id: PromOperationId.NestedQuery,
      name: 'Binary operation with query',
      params: [],
      defaultParams: [],
      category: PromVisualQueryOperationCategory.BinaryOps,
      renderer: (model, def, innerExpr) => innerExpr,
      addOperationHandler: addNestedQueryHandler,
    },
    createFunction({ id: PromOperationId.Absent }),
    createFunction({
      id: PromOperationId.Acos,
      category: PromVisualQueryOperationCategory.Trigonometric,
    }),
    createFunction({
      id: PromOperationId.Acosh,
      category: PromVisualQueryOperationCategory.Trigonometric,
    }),
    createFunction({
      id: PromOperationId.Asin,
      category: PromVisualQueryOperationCategory.Trigonometric,
    }),
    createFunction({
      id: PromOperationId.Asinh,
      category: PromVisualQueryOperationCategory.Trigonometric,
    }),
    createFunction({
      id: PromOperationId.Atan,
      category: PromVisualQueryOperationCategory.Trigonometric,
    }),
    createFunction({
      id: PromOperationId.Atanh,
      category: PromVisualQueryOperationCategory.Trigonometric,
    }),
    createFunction({ id: PromOperationId.Ceil }),
    createFunction({
      id: PromOperationId.Clamp,
      name: 'Clamp',
      params: [
        { name: 'Minimum Scalar', type: 'number' },
        { name: 'Maximum Scalar', type: 'number' },
      ],
      defaultParams: [1, 1],
    }),

    createFunction({
      id: PromOperationId.ClampMax,
      params: [{ name: 'Maximum Scalar', type: 'number' }],
      defaultParams: [1],
    }),
    createFunction({
      id: PromOperationId.ClampMin,
      params: [{ name: 'Minimum Scalar', type: 'number' }],
      defaultParams: [1],
    }),
    createFunction({
      id: PromOperationId.Cos,
      category: PromVisualQueryOperationCategory.Trigonometric,
    }),
    createFunction({
      id: PromOperationId.Cosh,
      category: PromVisualQueryOperationCategory.Trigonometric,
    }),
    createFunction({
      id: PromOperationId.DayOfMonth,
      category: PromVisualQueryOperationCategory.Time,
    }),
    createFunction({
      id: PromOperationId.DayOfWeek,
      category: PromVisualQueryOperationCategory.Time,
    }),
    createFunction({
      id: PromOperationId.DaysInMonth,
      category: PromVisualQueryOperationCategory.Time,
    }),
    createFunction({ id: PromOperationId.Deg }),
    createRangeFunction(PromOperationId.Deriv),
    //
    createFunction({ id: PromOperationId.Exp }),
    createFunction({ id: PromOperationId.Floor }),
    createFunction({ id: PromOperationId.Group }),
    createFunction({ id: PromOperationId.Hour }),
    createFunction({
      id: PromOperationId.LabelJoin,
      params: [
        {
          name: 'Destination Label',
          type: 'string',
          editor: LabelParamEditor,
        },
        {
          name: 'Separator',
          type: 'string',
        },
        {
          name: 'Source Label',
          type: 'string',
          restParam: true,
          optional: true,
          editor: LabelParamEditor,
        },
      ],
      defaultParams: ['', ',', ''],
      renderer: labelJoinRenderer,
      addOperationHandler: labelJoinAddOperationHandler,
    }),
    createFunction({ id: PromOperationId.Log10 }),
    createFunction({ id: PromOperationId.Log2 }),
    createFunction({ id: PromOperationId.Minute }),
    createFunction({ id: PromOperationId.Month }),
    createFunction({
      id: PromOperationId.Pi,
      renderer: (model) => `${model.id}()`,
    }),
    createFunction({
      id: PromOperationId.Quantile,
      params: [{ name: 'Value', type: 'number' }],
      defaultParams: [1],
      renderer: functionRendererLeft,
    }),
    createFunction({ id: PromOperationId.Rad }),
    createRangeFunction(PromOperationId.Resets),
    createFunction({
      id: PromOperationId.Round,
      category: PromVisualQueryOperationCategory.Functions,
      params: [{ name: 'To Nearest', type: 'number' }],
      defaultParams: [1],
    }),
    createFunction({ id: PromOperationId.Scalar }),
    createFunction({ id: PromOperationId.Sgn }),
    createFunction({ id: PromOperationId.Sin, category: PromVisualQueryOperationCategory.Trigonometric }),
    createFunction({
      id: PromOperationId.Sinh,
      category: PromVisualQueryOperationCategory.Trigonometric,
    }),
    createFunction({ id: PromOperationId.Sort }),
    createFunction({ id: PromOperationId.SortDesc }),
    createFunction({ id: PromOperationId.Sqrt }),
    createFunction({ id: PromOperationId.Stddev }),
    createFunction({
      id: PromOperationId.Tan,
      category: PromVisualQueryOperationCategory.Trigonometric,
    }),
    createFunction({
      id: PromOperationId.Tanh,
      category: PromVisualQueryOperationCategory.Trigonometric,
    }),
    createFunction({
      id: PromOperationId.Time,
      renderer: (model) => `${model.id}()`,
    }),
    createFunction({ id: PromOperationId.Timestamp }),
    createFunction({
      id: PromOperationId.Vector,
      params: [{ name: 'Value', type: 'number' }],
      defaultParams: [1],
      renderer: (model) => `${model.id}(${model.params[0]})`,
    }),
    createFunction({ id: PromOperationId.Year }),
  ];

  return list;
}

export function createFunction(definition: Partial<QueryBuilderOperationDef>): QueryBuilderOperationDef {
  return {
    ...definition,
    id: definition.id!,
    name: definition.name ?? getPromAndLokiOperationDisplayName(definition.id!),
    params: definition.params ?? [],
    defaultParams: definition.defaultParams ?? [],
    category: definition.category ?? PromVisualQueryOperationCategory.Functions,
    renderer: definition.renderer ?? (definition.params ? functionRendererRight : functionRendererLeft),
    addOperationHandler: definition.addOperationHandler ?? defaultAddOperationHandler,
  };
}

export function createRangeFunction(name: string, withRateInterval = false): QueryBuilderOperationDef {
  return {
    id: name,
    name: getPromAndLokiOperationDisplayName(name),
    params: [getRangeVectorParamDef(withRateInterval)],
    defaultParams: [withRateInterval ? '$__rate_interval' : '$__interval'],
    alternativesKey: 'range function',
    category: PromVisualQueryOperationCategory.RangeFunctions,
    renderer: operationWithRangeVectorRenderer,
    addOperationHandler: addOperationWithRangeVector,
    changeTypeHandler: operationTypeChangedHandlerForRangeFunction,
  };
}

function operationTypeChangedHandlerForRangeFunction(
  operation: QueryBuilderOperation,
  newDef: QueryBuilderOperationDef
) {
  // validate current parameter
  if (operation.params[0] === '$__rate_interval' && newDef.defaultParams[0] !== '$__rate_interval') {
    operation.params = newDef.defaultParams;
  } else if (operation.params[0] === '$__interval' && newDef.defaultParams[0] !== '$__interval') {
    operation.params = newDef.defaultParams;
  }

  return operation;
}

export function operationWithRangeVectorRenderer(
  model: QueryBuilderOperation,
  def: QueryBuilderOperationDef,
  innerExpr: string
) {
  let rangeVector = (model.params ?? [])[0] ?? '5m';
  return `${def.id}(${innerExpr}[${rangeVector}])`;
}

/**
 * Since there can only be one operation with range vector this will replace the current one (if one was added )
 */
export function addOperationWithRangeVector(
  def: QueryBuilderOperationDef,
  query: PromVisualQuery,
  modeller: VisualQueryModeller
) {
  const newOperation: QueryBuilderOperation = {
    id: def.id,
    params: def.defaultParams,
  };

  if (query.operations.length > 0) {
    // If operation exists it has to be in the registry so no point to check if it was found
    const firstOp = modeller.getOperationDef(query.operations[0].id)!;

    if (firstOp.addOperationHandler === addOperationWithRangeVector) {
      return {
        ...query,
        operations: [newOperation, ...query.operations.slice(1)],
      };
    }
  }

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

function labelJoinRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
  if (typeof model.params[1] !== 'string') {
    throw 'The separator must be a string';
  }
  const separator = `"${model.params[1]}"`;
  return `${model.id}(${innerExpr}, "${model.params[0]}", ${separator}, "${model.params.slice(2).join(separator)}")`;
}

function labelJoinAddOperationHandler<T extends QueryWithOperations>(def: QueryBuilderOperationDef, query: T) {
  const newOperation: QueryBuilderOperation = {
    id: def.id,
    params: def.defaultParams,
  };

  return {
    ...query,
    operations: [...query.operations, newOperation],
  };
}
