import React, { useCallback, useEffect, useRef } from 'react';
import { InlineField, Select } from '@grafana/ui';
import { ClassicConditions } from './components/ClassicConditions';
import { Math } from './components/Math';
import { Reduce } from './components/Reduce';
import { Resample } from './components/Resample';
import { Threshold } from './components/Threshold';
import { ExpressionQueryType, expressionTypes } from './types';
import { getDefaults } from './utils/expressionTypes';
const labelWidth = 15;
function useExpressionsCache() {
    const expressionCache = useRef({});
    const getCachedExpression = useCallback((queryType) => {
        switch (queryType) {
            case ExpressionQueryType.math:
            case ExpressionQueryType.reduce:
            case ExpressionQueryType.resample:
            case ExpressionQueryType.threshold:
                return expressionCache.current[queryType];
            case ExpressionQueryType.classic:
                return undefined;
        }
    }, []);
    const setCachedExpression = useCallback((queryType, value) => {
        switch (queryType) {
            case ExpressionQueryType.math:
                expressionCache.current.math = value;
                break;
            // We want to use the same value for Reduce, Resample and Threshold
            case ExpressionQueryType.reduce:
            case ExpressionQueryType.resample:
            case ExpressionQueryType.resample:
                expressionCache.current.reduce = value;
                expressionCache.current.resample = value;
                expressionCache.current.threshold = value;
                break;
        }
    }, []);
    return { getCachedExpression, setCachedExpression };
}
export function ExpressionQueryEditor(props) {
    const { query, queries, onRunQuery, onChange } = props;
    const { getCachedExpression, setCachedExpression } = useExpressionsCache();
    useEffect(() => {
        setCachedExpression(query.type, query.expression);
    }, [query.expression, query.type, setCachedExpression]);
    const onSelectExpressionType = useCallback((item) => {
        const cachedExpression = getCachedExpression(item.value);
        const defaults = getDefaults(Object.assign(Object.assign({}, query), { type: item.value }));
        onChange(Object.assign(Object.assign({}, defaults), { expression: cachedExpression !== null && cachedExpression !== void 0 ? cachedExpression : defaults.expression }));
    }, [query, onChange, getCachedExpression]);
    const renderExpressionType = () => {
        const refIds = queries.filter((q) => query.refId !== q.refId).map((q) => ({ value: q.refId, label: q.refId }));
        switch (query.type) {
            case ExpressionQueryType.math:
                return React.createElement(Math, { onChange: onChange, query: query, labelWidth: labelWidth, onRunQuery: onRunQuery });
            case ExpressionQueryType.reduce:
                return React.createElement(Reduce, { refIds: refIds, onChange: onChange, labelWidth: labelWidth, query: query });
            case ExpressionQueryType.resample:
                return React.createElement(Resample, { query: query, labelWidth: labelWidth, onChange: onChange, refIds: refIds });
            case ExpressionQueryType.classic:
                return React.createElement(ClassicConditions, { onChange: onChange, query: query, refIds: refIds });
            case ExpressionQueryType.threshold:
                return React.createElement(Threshold, { onChange: onChange, query: query, labelWidth: labelWidth, refIds: refIds });
        }
    };
    const selected = expressionTypes.find((o) => o.value === query.type);
    return (React.createElement("div", null,
        React.createElement(InlineField, { label: "Operation", labelWidth: labelWidth },
            React.createElement(Select, { options: expressionTypes, value: selected, onChange: onSelectExpressionType, width: 25 })),
        renderExpressionType()));
}
//# sourceMappingURL=ExpressionQueryEditor.js.map