import { capitalize } from 'lodash';
import pluralize from 'pluralize';
import { LabelParamEditor } from '../components/LabelParamEditor';
import { PromVisualQueryOperationCategory } from '../types';
export function functionRendererLeft(model, def, innerExpr) {
    const params = renderParams(model, def, innerExpr);
    const str = model.id + '(';
    if (innerExpr) {
        params.push(innerExpr);
    }
    return str + params.join(', ') + ')';
}
export function functionRendererRight(model, def, innerExpr) {
    const params = renderParams(model, def, innerExpr);
    const str = model.id + '(';
    if (innerExpr) {
        params.unshift(innerExpr);
    }
    return str + params.join(', ') + ')';
}
function rangeRendererWithParams(model, def, innerExpr, renderLeft) {
    var _a, _b;
    if (def.params.length < 2) {
        throw `Cannot render a function with params of length [${def.params.length}]`;
    }
    let rangeVector = (_b = ((_a = model.params) !== null && _a !== void 0 ? _a : [])[0]) !== null && _b !== void 0 ? _b : '5m';
    // Next frame the remaining parameters, but get rid of the first one because it's used to move the
    // instant vector into a range vector.
    const params = renderParams(Object.assign(Object.assign({}, model), { params: model.params.slice(1) }), Object.assign(Object.assign({}, def), { params: def.params.slice(1), defaultParams: def.defaultParams.slice(1) }), innerExpr);
    const str = model.id + '(';
    // Depending on the renderLeft variable, render parameters to the left or right
    // renderLeft === true (renderLeft) => (param1, param2, rangeVector[...])
    // renderLeft === false (renderRight) => (rangeVector[...], param1, param2)
    if (innerExpr) {
        renderLeft ? params.push(`${innerExpr}[${rangeVector}]`) : params.unshift(`${innerExpr}[${rangeVector}]`);
    }
    // stick everything together
    return str + params.join(', ') + ')';
}
export function rangeRendererRightWithParams(model, def, innerExpr) {
    return rangeRendererWithParams(model, def, innerExpr, false);
}
export function rangeRendererLeftWithParams(model, def, innerExpr) {
    return rangeRendererWithParams(model, def, innerExpr, true);
}
function renderParams(model, def, innerExpr) {
    var _a;
    return ((_a = model.params) !== null && _a !== void 0 ? _a : []).map((value, index) => {
        const paramDef = def.params[index];
        if (paramDef.type === 'string') {
            return '"' + value + '"';
        }
        return value;
    });
}
export function defaultAddOperationHandler(def, query) {
    const newOperation = {
        id: def.id,
        params: def.defaultParams,
    };
    return Object.assign(Object.assign({}, query), { operations: [...query.operations, newOperation] });
}
export function getPromAndLokiOperationDisplayName(funcName) {
    return capitalize(funcName.replace(/_/g, ' '));
}
export function getOperationParamId(operationId, paramIndex) {
    return `operations.${operationId}.param.${paramIndex}`;
}
export function getRangeVectorParamDef(withRateInterval = false) {
    const param = {
        name: 'Range',
        type: 'string',
        options: [
            {
                label: '$__interval',
                value: '$__interval',
                // tooltip: 'Dynamic interval based on max data points, scrape and min interval',
            },
            { label: '1m', value: '1m' },
            { label: '5m', value: '5m' },
            { label: '10m', value: '10m' },
            { label: '1h', value: '1h' },
            { label: '24h', value: '24h' },
        ],
    };
    if (withRateInterval) {
        param.options.unshift({
            label: '$__rate_interval',
            value: '$__rate_interval',
            // tooltip: 'Always above 4x scrape interval',
        });
    }
    return param;
}
/**
 * This function is shared between Prometheus and Loki variants
 */
export function createAggregationOperation(name, overrides = {}) {
    const operations = [
        Object.assign({ id: name, name: getPromAndLokiOperationDisplayName(name), params: [
                {
                    name: 'By label',
                    type: 'string',
                    restParam: true,
                    optional: true,
                },
            ], defaultParams: [], alternativesKey: 'plain aggregations', category: PromVisualQueryOperationCategory.Aggregations, renderer: functionRendererLeft, paramChangedHandler: getOnLabelAddedHandler(`__${name}_by`), explainHandler: getAggregationExplainer(name, ''), addOperationHandler: defaultAddOperationHandler }, overrides),
        Object.assign({ id: `__${name}_by`, name: `${getPromAndLokiOperationDisplayName(name)} by`, params: [
                {
                    name: 'Label',
                    type: 'string',
                    restParam: true,
                    optional: true,
                    editor: LabelParamEditor,
                },
            ], defaultParams: [''], alternativesKey: 'aggregations by', category: PromVisualQueryOperationCategory.Aggregations, renderer: getAggregationByRenderer(name), paramChangedHandler: getLastLabelRemovedHandler(name), explainHandler: getAggregationExplainer(name, 'by'), addOperationHandler: defaultAddOperationHandler, hideFromList: true }, overrides),
        Object.assign({ id: `__${name}_without`, name: `${getPromAndLokiOperationDisplayName(name)} without`, params: [
                {
                    name: 'Label',
                    type: 'string',
                    restParam: true,
                    optional: true,
                    editor: LabelParamEditor,
                },
            ], defaultParams: [''], alternativesKey: 'aggregations by', category: PromVisualQueryOperationCategory.Aggregations, renderer: getAggregationWithoutRenderer(name), paramChangedHandler: getLastLabelRemovedHandler(name), explainHandler: getAggregationExplainer(name, 'without'), addOperationHandler: defaultAddOperationHandler, hideFromList: true }, overrides),
    ];
    return operations;
}
export function createAggregationOperationWithParam(name, paramsDef, overrides = {}) {
    const operations = createAggregationOperation(name, overrides);
    operations[0].params.unshift(...paramsDef.params);
    operations[1].params.unshift(...paramsDef.params);
    operations[2].params.unshift(...paramsDef.params);
    operations[0].defaultParams = paramsDef.defaultParams;
    operations[1].defaultParams = [...paramsDef.defaultParams, ''];
    operations[2].defaultParams = [...paramsDef.defaultParams, ''];
    operations[1].renderer = getAggregationByRendererWithParameter(name);
    operations[2].renderer = getAggregationByRendererWithParameter(name);
    return operations;
}
function getAggregationByRenderer(aggregation) {
    return function aggregationRenderer(model, def, innerExpr) {
        return `${aggregation} by(${model.params.join(', ')}) (${innerExpr})`;
    };
}
function getAggregationWithoutRenderer(aggregation) {
    return function aggregationRenderer(model, def, innerExpr) {
        return `${aggregation} without(${model.params.join(', ')}) (${innerExpr})`;
    };
}
/**
 * Very simple poc implementation, needs to be modified to support all aggregation operators
 */
export function getAggregationExplainer(aggregationName, mode) {
    return function aggregationExplainer(model) {
        const labels = model.params.map((label) => `\`${label}\``).join(' and ');
        const labelWord = pluralize('label', model.params.length);
        switch (mode) {
            case 'by':
                return `Calculates ${aggregationName} over dimensions while preserving ${labelWord} ${labels}.`;
            case 'without':
                return `Calculates ${aggregationName} over the dimensions ${labels}. All other labels are preserved.`;
            default:
                return `Calculates ${aggregationName} over the dimensions.`;
        }
    };
}
function getAggregationByRendererWithParameter(aggregation) {
    return function aggregationRenderer(model, def, innerExpr) {
        const restParamIndex = def.params.findIndex((param) => param.restParam);
        const params = model.params.slice(0, restParamIndex);
        const restParams = model.params.slice(restParamIndex);
        return `${aggregation} by(${restParams.join(', ')}) (${params
            .map((param, idx) => (def.params[idx].type === 'string' ? `\"${param}\"` : param))
            .join(', ')}, ${innerExpr})`;
    };
}
/**
 * This function will transform operations without labels to their plan aggregation operation
 */
export function getLastLabelRemovedHandler(changeToOperationId) {
    return function onParamChanged(index, op, def) {
        // If definition has more params then is defined there are no optional rest params anymore.
        // We then transform this operation into a different one
        if (op.params.length < def.params.length) {
            return Object.assign(Object.assign({}, op), { id: changeToOperationId });
        }
        return op;
    };
}
export function getOnLabelAddedHandler(changeToOperationId) {
    return function onParamChanged(index, op, def) {
        // Check if we actually have the label param. As it's optional the aggregation can have one less, which is the
        // case of just simple aggregation without label. When user adds the label it now has the same number of params
        // as its definition, and now we can change it to its `_by` variant.
        if (op.params.length === def.params.length) {
            return Object.assign(Object.assign({}, op), { id: changeToOperationId });
        }
        return op;
    };
}
export function isConflictingSelector(newLabel, labels) {
    if (!newLabel.label || !newLabel.op || !newLabel.value) {
        return false;
    }
    if (labels.length < 2) {
        return false;
    }
    const operationIsNegative = newLabel.op.toString().startsWith('!');
    const candidates = labels.filter((label) => label.label === newLabel.label && label.value === newLabel.value && label.op !== newLabel.op);
    const conflict = candidates.some((candidate) => {
        var _a, _b;
        if (operationIsNegative && ((_a = candidate === null || candidate === void 0 ? void 0 : candidate.op) === null || _a === void 0 ? void 0 : _a.toString().startsWith('!')) === false) {
            return true;
        }
        if (operationIsNegative === false && ((_b = candidate === null || candidate === void 0 ? void 0 : candidate.op) === null || _b === void 0 ? void 0 : _b.toString().startsWith('!'))) {
            return true;
        }
        return false;
    });
    return conflict;
}
//# sourceMappingURL=operationUtils.js.map