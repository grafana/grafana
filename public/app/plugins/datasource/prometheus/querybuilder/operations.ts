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
    createUncategorizedFunction(PromOperationId.Abs, 'Absolute Value'),
    createUncategorizedFunction(PromOperationId.Absent, 'Absent'),
    createUncategorizedFunction(PromOperationId.AbsentOverTime, 'Absent over time'),
    createUncategorizedFunction(PromOperationId.Acos, 'Arc Cosine'),
    createUncategorizedFunction(PromOperationId.Acosh, 'Inverse Arc Cosine'),
    createUncategorizedFunction(PromOperationId.Asin, 'Arc Sine'),
    createUncategorizedFunction(PromOperationId.Asinh, 'Inverse Arc Sine'),
    createUncategorizedFunction(PromOperationId.Atan, 'Arc Tangent'),
    createUncategorizedFunction(PromOperationId.Atanh, 'Inverse Arc Tangent'),
    createUncategorizedFunction(PromOperationId.BottomK, 'Bottom (K)'),
    createUncategorizedFunction(PromOperationId.Ceil, 'Ceiling'),
    createUncategorizedFunction(PromOperationId.Clamp, 'Clamp'),
    createUncategorizedFunction(PromOperationId.ClampMax, 'Clamp Maximum'),
    createUncategorizedFunction(PromOperationId.ClampMin, 'Clamp Minimum'),
    createUncategorizedFunction(PromOperationId.Cos, 'Cosine'),
    createUncategorizedFunction(PromOperationId.Cosh, 'Inverse Cosine'),
    createUncategorizedFunction(PromOperationId.CountScalar, 'Count Scalar'),
    createUncategorizedFunction(PromOperationId.CountValues, 'Count Values'),
    createUncategorizedFunction(PromOperationId.DayOfMonth, 'Day of the Month'),
    createUncategorizedFunction(PromOperationId.DayOfWeek, 'Day of the Week'),
    createUncategorizedFunction(PromOperationId.DaysInMonth, 'Days in Month'),
    createUncategorizedFunction(PromOperationId.Deg, 'Degrees'),
    createUncategorizedFunction(PromOperationId.Deriv, 'Derivative'),
    createUncategorizedFunction(PromOperationId.DropCommonLabels, 'Drop Common Labels'),
    createUncategorizedFunction(PromOperationId.Exp, 'Exponent'),
    createUncategorizedFunction(PromOperationId.Floor, 'Floor'),
    createUncategorizedFunction(PromOperationId.Group, 'Group'),
    createUncategorizedFunction(PromOperationId.HoltWinters, 'Holt Winters (Predictive)'),
    createUncategorizedFunction(PromOperationId.Hour, 'Hour'),
    createUncategorizedFunction(PromOperationId.Idelta, 'Idelta'),
    createUncategorizedFunction(PromOperationId.LabelJoin, 'Join Labels'),
    createUncategorizedFunction(PromOperationId.Last, 'Last'),
    createUncategorizedFunction(PromOperationId.Log10, 'Log(10)'),
    createUncategorizedFunction(PromOperationId.Log2, 'Log(2)'),
    createUncategorizedFunction(PromOperationId.Minute, 'Minute'),
    createUncategorizedFunction(PromOperationId.Month, 'Month'),
    createUncategorizedFunction(PromOperationId.Pi, 'PI'),
    createUncategorizedFunction(PromOperationId.PredictLinear, 'PredictLinear'),
    createUncategorizedFunction(PromOperationId.Present, 'Present'),
    createUncategorizedFunction(PromOperationId.Quantile, 'Quantile'),
    createUncategorizedFunction(PromOperationId.QuantileOverTime, 'Quantile over time'),
    createUncategorizedFunction(PromOperationId.Rad, 'Radians'),
    createUncategorizedFunction(PromOperationId.Resets, 'Resets'),
    createUncategorizedFunction(PromOperationId.Round, 'Round'),
    createUncategorizedFunction(PromOperationId.Scalar, 'Scalar'),
    createUncategorizedFunction(PromOperationId.Sgn, 'Sgn'),
    createUncategorizedFunction(PromOperationId.Sin, 'Sine'),
    createUncategorizedFunction(PromOperationId.Sinh, 'Inverse Sine'),
    createUncategorizedFunction(PromOperationId.Sort, 'Sort'),
    createUncategorizedFunction(PromOperationId.SortDesc, 'Sort by description'),
    createUncategorizedFunction(PromOperationId.Sqrt, 'Square root'),
    createUncategorizedFunction(PromOperationId.Stddev, 'Standard deviation'),
    createUncategorizedFunction(PromOperationId.Tan, 'Tangent'),
    createUncategorizedFunction(PromOperationId.Tanh, 'Inverse Tangent'),
    createUncategorizedFunction(PromOperationId.Time, 'Time'),
    createUncategorizedFunction(PromOperationId.Timestamp, 'Timestamp'),
    createUncategorizedFunction(PromOperationId.Vector, 'Vector'),
    createUncategorizedFunction(PromOperationId.Year, 'Year'),
  ];

  return list;
}

function createUncategorizedFunction(id: PromOperationId, name: string): QueryBuilderOperationDef {
  return {
    id,
    name,
    params: [],
    defaultParams: [],
    category: PromVisualQueryOperationCategory.Uncategorized,
    renderer: functionRendererLeft,
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
