import { ReducerID } from '@grafana/data';
export var ExpressionQueryType;
(function (ExpressionQueryType) {
    ExpressionQueryType["math"] = "math";
    ExpressionQueryType["reduce"] = "reduce";
    ExpressionQueryType["resample"] = "resample";
    ExpressionQueryType["classic"] = "classic_conditions";
})(ExpressionQueryType || (ExpressionQueryType = {}));
export var gelTypes = [
    { value: ExpressionQueryType.math, label: 'Math' },
    { value: ExpressionQueryType.reduce, label: 'Reduce' },
    { value: ExpressionQueryType.resample, label: 'Resample' },
    { value: ExpressionQueryType.classic, label: 'Classic condition' },
];
export var reducerTypes = [
    { value: ReducerID.min, label: 'Min', description: 'Get the minimum value' },
    { value: ReducerID.max, label: 'Max', description: 'Get the maximum value' },
    { value: ReducerID.mean, label: 'Mean', description: 'Get the average value' },
    { value: ReducerID.sum, label: 'Sum', description: 'Get the sum of all values' },
    { value: ReducerID.count, label: 'Count', description: 'Get the number of values' },
];
export var downsamplingTypes = [
    { value: ReducerID.min, label: 'Min', description: 'Fill with the minimum value' },
    { value: ReducerID.max, label: 'Max', description: 'Fill with the maximum value' },
    { value: ReducerID.mean, label: 'Mean', description: 'Fill with the average value' },
    { value: ReducerID.sum, label: 'Sum', description: 'Fill with the sum of all values' },
];
export var upsamplingTypes = [
    { value: 'pad', label: 'pad', description: 'fill with the last known value' },
    { value: 'backfilling', label: 'backfilling', description: 'fill with the next known value' },
    { value: 'fillna', label: 'fillna', description: 'Fill with NaNs' },
];
//# sourceMappingURL=types.js.map