import { __read } from "tslib";
import React, { useCallback, useState } from 'react';
import { AdHocFilterKey, REMOVE_FILTER_KEY } from './AdHocFilterKey';
import { AdHocFilterRenderer } from './AdHocFilterRenderer';
export var AdHocFilterBuilder = function (_a) {
    var datasource = _a.datasource, appendBefore = _a.appendBefore, onCompleted = _a.onCompleted;
    var _b = __read(useState(null), 2), key = _b[0], setKey = _b[1];
    var _c = __read(useState('='), 2), operator = _c[0], setOperator = _c[1];
    var onKeyChanged = useCallback(function (item) {
        var _a;
        if (item.value !== REMOVE_FILTER_KEY) {
            setKey((_a = item.value) !== null && _a !== void 0 ? _a : '');
            return;
        }
        setKey(null);
    }, [setKey]);
    var onOperatorChanged = useCallback(function (item) { var _a; return setOperator((_a = item.value) !== null && _a !== void 0 ? _a : ''); }, [
        setOperator,
    ]);
    var onValueChanged = useCallback(function (item) {
        var _a;
        onCompleted({
            value: (_a = item.value) !== null && _a !== void 0 ? _a : '',
            operator: operator,
            condition: '',
            key: key,
        });
        setKey(null);
        setOperator('=');
    }, [onCompleted, operator, key]);
    if (key === null) {
        return React.createElement(AdHocFilterKey, { datasource: datasource, filterKey: key, onChange: onKeyChanged });
    }
    return (React.createElement(React.Fragment, { key: "filter-builder" },
        appendBefore,
        React.createElement(AdHocFilterRenderer, { datasource: datasource, filter: { key: key, value: '', operator: operator, condition: '' }, placeHolder: "select value", onKeyChange: onKeyChanged, onOperatorChange: onOperatorChanged, onValueChange: onValueChanged })));
};
//# sourceMappingURL=AdHocFilterBuilder.js.map