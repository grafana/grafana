import { addOperationWithRangeVector } from './operations';
import { createAggregationOperation, createAggregationOperationWithParam, getPromAndLokiOperationDisplayName, getRangeVectorParamDef, } from './shared/operationUtils';
import { PromVisualQueryOperationCategory, PromOperationId } from './types';
export function getAggregationOperations() {
    return [
        ...createAggregationOperation(PromOperationId.Sum),
        ...createAggregationOperation(PromOperationId.Avg),
        ...createAggregationOperation(PromOperationId.Min),
        ...createAggregationOperation(PromOperationId.Max),
        ...createAggregationOperation(PromOperationId.Count),
        ...createAggregationOperationWithParam(PromOperationId.TopK, {
            params: [{ name: 'K-value', type: 'number' }],
            defaultParams: [5],
        }),
        ...createAggregationOperationWithParam(PromOperationId.BottomK, {
            params: [{ name: 'K-value', type: 'number' }],
            defaultParams: [5],
        }),
        ...createAggregationOperationWithParam(PromOperationId.CountValues, {
            params: [{ name: 'Identifier', type: 'string' }],
            defaultParams: ['count'],
        }),
        createAggregationOverTime(PromOperationId.SumOverTime),
        createAggregationOverTime(PromOperationId.AvgOverTime),
        createAggregationOverTime(PromOperationId.MinOverTime),
        createAggregationOverTime(PromOperationId.MaxOverTime),
        createAggregationOverTime(PromOperationId.CountOverTime),
        createAggregationOverTime(PromOperationId.LastOverTime),
        createAggregationOverTime(PromOperationId.PresentOverTime),
        createAggregationOverTime(PromOperationId.AbsentOverTime),
        createAggregationOverTime(PromOperationId.StddevOverTime),
    ];
}
function createAggregationOverTime(name) {
    return {
        id: name,
        name: getPromAndLokiOperationDisplayName(name),
        params: [getRangeVectorParamDef()],
        defaultParams: ['$__interval'],
        alternativesKey: 'overtime function',
        category: PromVisualQueryOperationCategory.RangeFunctions,
        renderer: operationWithRangeVectorRenderer,
        addOperationHandler: addOperationWithRangeVector,
    };
}
function operationWithRangeVectorRenderer(model, def, innerExpr) {
    var _a, _b;
    let rangeVector = (_b = ((_a = model.params) !== null && _a !== void 0 ? _a : [])[0]) !== null && _b !== void 0 ? _b : '$__interval';
    return `${def.id}(${innerExpr}[${rangeVector}])`;
}
//# sourceMappingURL=aggregations.js.map