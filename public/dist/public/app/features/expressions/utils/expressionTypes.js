import { ReducerID } from '@grafana/data';
import { ExpressionQueryType } from '../types';
import { EvalFunction } from '../../alerting/state/alertDef';
export var getDefaults = function (query) {
    switch (query.type) {
        case ExpressionQueryType.reduce:
            if (!query.reducer) {
                query.reducer = ReducerID.mean;
            }
            query.expression = undefined;
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
export var defaultCondition = {
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