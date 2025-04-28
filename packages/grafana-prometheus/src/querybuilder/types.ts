// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/types.ts
import { VisualQueryBinary } from './shared/LokiAndPromQueryModellerBase';
import { QueryBuilderLabelFilter, QueryBuilderOperation } from './shared/types';

/**
 * Visual query model
 */
export interface PromVisualQuery {
  metric: string;
  labels: QueryBuilderLabelFilter[];
  operations: QueryBuilderOperation[];
  binaryQueries?: PromVisualQueryBinary[];
  // metrics explorer additional settings
  useBackend?: boolean;
  disableTextWrap?: boolean;
  includeNullMetadata?: boolean;
  fullMetaSearch?: boolean;
}

export type PromVisualQueryBinary = VisualQueryBinary<PromVisualQuery>;

export enum PromVisualQueryOperationCategory {
  Aggregations = 'Aggregations',
  RangeFunctions = 'Range functions',
  Functions = 'Functions',
  BinaryOps = 'Binary operations',
  Trigonometric = 'Trigonometric',
  Time = 'Time Functions',
}

export enum PromOperationId {
  Abs = 'abs',
  Absent = 'absent',
  AbsentOverTime = 'absent_over_time',
  Acos = 'acos',
  Acosh = 'acosh',
  Asin = 'asin',
  Asinh = 'asinh',
  Atan = 'atan',
  Atanh = 'atanh',
  Avg = 'avg',
  AvgOverTime = 'avg_over_time',
  BottomK = 'bottomk',
  Ceil = 'ceil',
  Changes = 'changes',
  Clamp = 'clamp',
  ClampMax = 'clamp_max',
  ClampMin = 'clamp_min',
  Cos = 'cos',
  Cosh = 'cosh',
  Count = 'count',
  CountOverTime = 'count_over_time',
  CountScalar = 'count_scalar',
  CountValues = 'count_values',
  DayOfMonth = 'day_of_month',
  DayOfWeek = 'day_of_week',
  DayOfYear = 'day_of_year',
  DaysInMonth = 'days_in_month',
  Deg = 'deg',
  Delta = 'delta',
  Deriv = 'deriv',
  DoubleExponentialSmoothing = 'double_exponential_smoothing',
  DropCommonLabels = 'drop_common_labels',
  Exp = 'exp',
  Floor = 'floor',
  Group = 'group',
  HistogramQuantile = 'histogram_quantile',
  HistogramAvg = 'histogram_avg',
  HistogramCount = 'histogram_count',
  HistogramSum = 'histogram_sum',
  HistogramFraction = 'histogram_fraction',
  HistogramStddev = 'histogram_stddev',
  HistogramStdvar = 'histogram_stdvar',
  // Renamed as DoubleExponentialSmoothing with Prometheus v3.x
  // https://github.com/prometheus/prometheus/pull/14930
  HoltWinters = 'holt_winters',
  Hour = 'hour',
  Idelta = 'idelta',
  Increase = 'increase',
  Info = 'info',
  Irate = 'irate',
  LabelJoin = 'label_join',
  LabelReplace = 'label_replace',
  Last = 'last',
  LastOverTime = 'last_over_time',
  Ln = 'ln',
  Log10 = 'log10',
  Log2 = 'log2',
  Max = 'max',
  MaxOverTime = 'max_over_time',
  Min = 'min',
  MinOverTime = 'min_over_time',
  Minute = 'minute',
  Month = 'month',
  Pi = 'pi',
  PredictLinear = 'predict_linear',
  Present = 'present',
  PresentOverTime = 'present_over_time',
  Quantile = 'quantile',
  QuantileOverTime = 'quantile_over_time',
  Rad = 'rad',
  Rate = 'rate',
  Resets = 'resets',
  Round = 'round',
  Scalar = 'scalar',
  Sgn = 'sgn',
  Sin = 'sin',
  Sinh = 'sinh',
  Sort = 'sort',
  SortDesc = 'sort_desc',
  Sqrt = 'sqrt',
  Stddev = 'stddev',
  StddevOverTime = 'stddev_over_time',
  Sum = 'sum',
  SumOverTime = 'sum_over_time',
  Tan = 'tan',
  Tanh = 'tanh',
  Time = 'time',
  Timestamp = 'timestamp',
  TopK = 'topk',
  Vector = 'vector',
  Year = 'year',
  // Binary ops
  Addition = '__addition',
  Subtraction = '__subtraction',
  MultiplyBy = '__multiply_by',
  DivideBy = '__divide_by',
  Modulo = '__modulo',
  Exponent = '__exponent',
  NestedQuery = '__nested_query',
  EqualTo = '__equal_to',
  NotEqualTo = '__not_equal_to',
  GreaterThan = '__greater_than',
  LessThan = '__less_than',
  GreaterOrEqual = '__greater_or_equal',
  LessOrEqual = '__less_or_equal',
}

export enum PromQueryPatternType {
  Rate = 'rate',
  Histogram = 'histogram',
  Binary = 'binary',
}

export interface PromQueryPattern {
  name: string;
  operations: QueryBuilderOperation[];
  type: PromQueryPatternType;
  binaryQueries?: PromVisualQueryBinary[];
}
