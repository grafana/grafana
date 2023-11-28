import { ReducerID } from '@grafana/data';
import { EvalFunction } from '../alerting/state/alertDef';
/**
 * MATCHES a constant in DataSourceWithBackend
 */
export const ExpressionDatasourceUID = '__expr__';
export var ExpressionQueryType;
(function (ExpressionQueryType) {
    ExpressionQueryType["math"] = "math";
    ExpressionQueryType["reduce"] = "reduce";
    ExpressionQueryType["resample"] = "resample";
    ExpressionQueryType["classic"] = "classic_conditions";
    ExpressionQueryType["threshold"] = "threshold";
})(ExpressionQueryType || (ExpressionQueryType = {}));
export const getExpressionLabel = (type) => {
    switch (type) {
        case ExpressionQueryType.math:
            return 'Math';
        case ExpressionQueryType.reduce:
            return 'Reduce';
        case ExpressionQueryType.resample:
            return 'Resample';
        case ExpressionQueryType.classic:
            return 'Classic condition';
        case ExpressionQueryType.threshold:
            return 'Threshold';
    }
};
export const expressionTypes = [
    {
        value: ExpressionQueryType.math,
        label: 'Math',
        description: 'Free-form math formulas on time series or number data.',
    },
    {
        value: ExpressionQueryType.reduce,
        label: 'Reduce',
        description: 'Takes one or more time series returned from a query or an expression and turns each series into a single number.',
    },
    {
        value: ExpressionQueryType.resample,
        label: 'Resample',
        description: 'Changes the time stamps in each time series to have a consistent time interval.',
    },
    {
        value: ExpressionQueryType.classic,
        label: 'Classic condition',
        description: 'Takes one or more time series returned from a query or an expression and checks if any of the series match the condition. Disables multi-dimensional alerts for this rule.',
    },
    {
        value: ExpressionQueryType.threshold,
        label: 'Threshold',
        description: 'Takes one or more time series returned from a query or an expression and checks if any of the series match the threshold condition.',
    },
];
export const reducerTypes = [
    { value: ReducerID.min, label: 'Min', description: 'Get the minimum value' },
    { value: ReducerID.max, label: 'Max', description: 'Get the maximum value' },
    { value: ReducerID.mean, label: 'Mean', description: 'Get the average value' },
    { value: ReducerID.sum, label: 'Sum', description: 'Get the sum of all values' },
    { value: ReducerID.count, label: 'Count', description: 'Get the number of values' },
    { value: ReducerID.last, label: 'Last', description: 'Get the last value' },
];
export var ReducerMode;
(function (ReducerMode) {
    ReducerMode["Strict"] = "";
    ReducerMode["ReplaceNonNumbers"] = "replaceNN";
    ReducerMode["DropNonNumbers"] = "dropNN";
})(ReducerMode || (ReducerMode = {}));
export const reducerModes = [
    {
        value: ReducerMode.Strict,
        label: 'Strict',
        description: 'Result can be NaN if series contains non-numeric data',
    },
    {
        value: ReducerMode.DropNonNumbers,
        label: 'Drop Non-numeric Values',
        description: 'Drop NaN, +/-Inf and null from input series before reducing',
    },
    {
        value: ReducerMode.ReplaceNonNumbers,
        label: 'Replace Non-numeric Values',
        description: 'Replace NaN, +/-Inf and null with a constant value before reducing',
    },
];
export const downsamplingTypes = [
    { value: ReducerID.last, label: 'Last', description: 'Fill with the last value' },
    { value: ReducerID.min, label: 'Min', description: 'Fill with the minimum value' },
    { value: ReducerID.max, label: 'Max', description: 'Fill with the maximum value' },
    { value: ReducerID.mean, label: 'Mean', description: 'Fill with the average value' },
    { value: ReducerID.sum, label: 'Sum', description: 'Fill with the sum of all values' },
];
export const upsamplingTypes = [
    { value: 'pad', label: 'pad', description: 'fill with the last known value' },
    { value: 'backfilling', label: 'backfilling', description: 'fill with the next known value' },
    { value: 'fillna', label: 'fillna', description: 'Fill with NaNs' },
];
export const thresholdFunctions = [
    { value: EvalFunction.IsAbove, label: 'Is above' },
    { value: EvalFunction.IsBelow, label: 'Is below' },
    { value: EvalFunction.IsWithinRange, label: 'Is within range' },
    { value: EvalFunction.IsOutsideRange, label: 'Is outside range' },
];
//# sourceMappingURL=types.js.map