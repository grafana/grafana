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
    createRangeFunction(PromOperationId.Rate),
    createRangeFunction(PromOperationId.Irate),
    createRangeFunction(PromOperationId.Increase),
    createRangeFunction(PromOperationId.Delta),
    // Not sure about this one. It could also be a more generic 'Simple math operation' where user specifies
    // both the operator and the operand in a single input
    {
      id: PromOperationId.MultiplyBy,
      name: 'Multiply by scalar',
      params: [{ name: 'Factor', type: 'number' }],
      defaultParams: [2],
      category: PromVisualQueryOperationCategory.BinaryOps,
      renderer: getSimpleBinaryRenderer('*'),
      addOperationHandler: defaultAddOperationHandler,
    },
    {
      id: PromOperationId.DivideBy,
      name: 'Divide by scalar',
      params: [{ name: 'Factor', type: 'number' }],
      defaultParams: [2],
      category: PromVisualQueryOperationCategory.BinaryOps,
      renderer: getSimpleBinaryRenderer('/'),
      addOperationHandler: defaultAddOperationHandler,
    },
    {
      id: PromOperationId.NestedQuery,
      name: 'Binary operation with query',
      params: [],
      defaultParams: [],
      category: PromVisualQueryOperationCategory.BinaryOps,
      renderer: (model, def, innerExpr) => innerExpr,
      addOperationHandler: addNestedQueryHandler,
    },
    createFunction({ id: PromOperationId.Absent, name: 'Absent' }),
    createRangeFunction(PromOperationId.AbsentOverTime),
    createFunction({
      id: PromOperationId.Acos,
      name: 'Arc Cosine',
      category: PromVisualQueryOperationCategory.Trigonometric,
    }),
    createFunction({
      id: PromOperationId.Acosh,
      name: 'Inverse Hyperbolic Cosine',
      category: PromVisualQueryOperationCategory.Trigonometric,
    }),
    createFunction({
      id: PromOperationId.Asin,
      name: 'Arc Sine',
      category: PromVisualQueryOperationCategory.Trigonometric,
    }),
    createFunction({
      id: PromOperationId.Asinh,
      name: 'Inverse Hyperbolic Sine',
      category: PromVisualQueryOperationCategory.Trigonometric,
    }),
    createFunction({
      id: PromOperationId.Atan,
      name: 'Arc Tangent',
      category: PromVisualQueryOperationCategory.Trigonometric,
    }),
    createFunction({
      id: PromOperationId.Atanh,
      name: 'Inverse Hyperbolic Tangent',
      category: PromVisualQueryOperationCategory.Trigonometric,
    }),
    createFunction({
      id: PromOperationId.BottomK,
      name: 'Bottom (K)',
      category: PromVisualQueryOperationCategory.Aggregations,
    }),
    createFunction({ id: PromOperationId.Ceil, name: 'Ceiling' }),
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
      name: 'Clamp Maximum',
      params: [{ name: 'Maximum Scalar', type: 'number' }],
      defaultParams: [1],
    }),
    createFunction({
      id: PromOperationId.ClampMin,
      name: 'Clamp Minimum',
      params: [{ name: 'Minimum Scalar', type: 'number' }],
      defaultParams: [1],
    }),
    createFunction({
      id: PromOperationId.Cos,
      name: 'Cosine',
      category: PromVisualQueryOperationCategory.Trigonometric,
    }),
    createFunction({
      id: PromOperationId.Cosh,
      name: 'Inverse Cosine',
      category: PromVisualQueryOperationCategory.Trigonometric,
    }),
    createFunction({
      id: PromOperationId.CountValues,
      name: 'Count Values',
      category: PromVisualQueryOperationCategory.Aggregations,
    }),
    createFunction({
      id: PromOperationId.DayOfMonth,
      name: 'Day of the Month',
      category: PromVisualQueryOperationCategory.Time,
    }),
    createFunction({
      id: PromOperationId.DayOfWeek,
      name: 'Day of the Week',
      category: PromVisualQueryOperationCategory.Time,
    }),
    createFunction({
      id: PromOperationId.DaysInMonth,
      name: 'Days in Month',
      category: PromVisualQueryOperationCategory.Time,
    }),
    createFunction({ id: PromOperationId.Deg, name: 'Degrees' }),
    createFunction({ id: PromOperationId.Deriv, name: 'Derivative' }),
    createFunction({ id: PromOperationId.Exp, name: 'Exponent' }),
    createFunction({ id: PromOperationId.Floor, name: 'Floor' }),
    createFunction({ id: PromOperationId.Group, name: 'Group' }),
    createFunction({ id: PromOperationId.HoltWinters, name: 'Holt Winters (Predictive)' }),
    createFunction({ id: PromOperationId.Hour, name: 'Hour' }),
    createFunction({ id: PromOperationId.Idelta, name: 'Idelta' }),
    createFunction({ id: PromOperationId.LabelJoin, name: 'Join Labels' }),
    createFunction({ id: PromOperationId.Last, name: 'Last' }),
    createFunction({ id: PromOperationId.Log10, name: 'Log(10)' }),
    createFunction({ id: PromOperationId.Log2, name: 'Log(2)' }),
    createFunction({ id: PromOperationId.Minute, name: 'Minute' }),
    createFunction({ id: PromOperationId.Month, name: 'Month' }),
    createFunction({ id: PromOperationId.Pi, name: 'PI' }),
    createFunction({ id: PromOperationId.PredictLinear, name: 'PredictLinear' }),
    createFunction({ id: PromOperationId.Present, name: 'Present' }),
    createFunction({ id: PromOperationId.Quantile, name: 'Quantile' }),
    createFunction({ id: PromOperationId.QuantileOverTime, name: 'Quantile over time' }),
    createFunction({ id: PromOperationId.Rad, name: 'Radians' }),
    createFunction({ id: PromOperationId.Resets, name: 'Resets' }),
    createFunction({
      id: PromOperationId.Round,
      name: 'Round',
      category: PromVisualQueryOperationCategory.Functions,
      params: [{ name: 'To Nearest', type: 'number' }],
      defaultParams: [1],
    }),
    createFunction({ id: PromOperationId.Scalar, name: 'Scalar' }),
    createFunction({ id: PromOperationId.Sgn, name: 'Sgn' }),
    createFunction({ id: PromOperationId.Sin, name: 'Sine', category: PromVisualQueryOperationCategory.Trigonometric }),
    createFunction({
      id: PromOperationId.Sinh,
      name: 'Hyperbolic Sine',
      category: PromVisualQueryOperationCategory.Trigonometric,
    }),
    createFunction({ id: PromOperationId.Sort, name: 'Sort' }),
    createFunction({ id: PromOperationId.SortDesc, name: 'Sort by description' }),
    createFunction({ id: PromOperationId.Sqrt, name: 'Square root' }),
    createFunction({ id: PromOperationId.Stddev, name: 'Standard deviation' }),
    createFunction({
      id: PromOperationId.Tan,
      name: 'Tangent',
      category: PromVisualQueryOperationCategory.Trigonometric,
    }),
    createFunction({
      id: PromOperationId.Tanh,
      name: 'Hyperbolic Tangent',
      category: PromVisualQueryOperationCategory.Trigonometric,
    }),
    createFunction({ id: PromOperationId.Time, name: 'Time' }),
    createFunction({ id: PromOperationId.Timestamp, name: 'Timestamp' }),
    createFunction({ id: PromOperationId.Vector, name: 'Vector' }),
    createFunction({ id: PromOperationId.Year, name: 'Year' }),
  ];

  return list;
}

function createFunction(definition: Partial<QueryBuilderOperationDef>): QueryBuilderOperationDef {
  return {
    ...definition,
    id: definition.id!,
    name: definition.name!,
    params: definition.params ?? [],
    defaultParams: definition.defaultParams ?? [],
    category: definition.category ?? PromVisualQueryOperationCategory.Functions,
    renderer: definition.defaultParams ? functionRendererRight : functionRendererLeft,
    addOperationHandler: defaultAddOperationHandler,
  };
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
