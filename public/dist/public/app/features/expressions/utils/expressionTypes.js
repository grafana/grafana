import { ReducerID } from '@grafana/data';
import { EvalFunction } from '../../alerting/state/alertDef';
import { ExpressionQueryType } from '../types';
export const getDefaults = (query) => {
    switch (query.type) {
        case ExpressionQueryType.reduce:
            if (!query.reducer) {
                query.reducer = ReducerID.mean;
            }
            break;
        case ExpressionQueryType.resample:
            if (!query.downsampler) {
                query.downsampler = ReducerID.mean;
            }
            if (!query.upsampler) {
                query.upsampler = 'fillna';
            }
            query.reducer = undefined;
            break;
        case ExpressionQueryType.math:
            query.expression = undefined;
            break;
        case ExpressionQueryType.classic:
            if (!query.conditions) {
                query.conditions = [defaultCondition];
            }
            break;
        default:
            query.reducer = undefined;
    }
    return query;
};
export const defaultCondition = {
    type: 'query',
    reducer: {
        params: [],
        type: 'avg',
    },
    operator: {
        type: 'and',
    },
    query: { params: [] },
    evaluator: {
        params: [0, 0],
        type: EvalFunction.IsAbove,
    },
};
//# sourceMappingURL=expressionTypes.js.map