import { __assign, __read } from "tslib";
import React, { useEffect, useState, useRef } from 'react';
import { InlineFieldRow } from '@grafana/ui';
import SubscriptionField from '../SubscriptionField';
import QueryField from './QueryField';
var ERROR_SOURCE = 'arg-subscriptions';
var ArgQueryEditor = function (_a) {
    var query = _a.query, datasource = _a.datasource, subscriptionId = _a.subscriptionId, variableOptionGroup = _a.variableOptionGroup, onChange = _a.onChange, setError = _a.setError;
    var fetchedRef = useRef(false);
    var _b = __read(useState([]), 2), subscriptions = _b[0], setSubscriptions = _b[1];
    useEffect(function () {
        if (fetchedRef.current) {
            return;
        }
        fetchedRef.current = true;
        datasource.azureMonitorDatasource
            .getSubscriptions()
            .then(function (results) {
            var _a, _b;
            var fetchedSubscriptions = results.map(function (v) { return ({ label: v.text, value: v.value, description: v.value }); });
            setSubscriptions(fetchedSubscriptions);
            setError(ERROR_SOURCE, undefined);
            if (!((_a = query.subscriptions) === null || _a === void 0 ? void 0 : _a.length) && (fetchedSubscriptions === null || fetchedSubscriptions === void 0 ? void 0 : fetchedSubscriptions.length)) {
                onChange(__assign(__assign({}, query), { subscriptions: [(_b = query.subscription) !== null && _b !== void 0 ? _b : fetchedSubscriptions[0].value] }));
            }
        })
            .catch(function (err) { return setError(ERROR_SOURCE, err); });
    }, [datasource, onChange, query, setError]);
    return (React.createElement("div", { "data-testid": "azure-monitor-logs-query-editor" },
        React.createElement(InlineFieldRow, null,
            React.createElement(SubscriptionField, { multiSelect: true, subscriptions: subscriptions, query: query, datasource: datasource, subscriptionId: subscriptionId, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError })),
        React.createElement(QueryField, { query: query, datasource: datasource, subscriptionId: subscriptionId, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError })));
};
export default ArgQueryEditor;
//# sourceMappingURL=ArgQueryEditor.js.map