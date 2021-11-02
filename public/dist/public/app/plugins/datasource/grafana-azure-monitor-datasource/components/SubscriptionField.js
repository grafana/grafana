import { __assign, __read, __spreadArray } from "tslib";
import React, { useCallback, useMemo } from 'react';
import { Select, MultiSelect } from '@grafana/ui';
import { AzureQueryType } from '../types';
import { findOptions } from '../utils/common';
import { Field } from './Field';
var SubscriptionField = function (_a) {
    var query = _a.query, subscriptions = _a.subscriptions, variableOptionGroup = _a.variableOptionGroup, onQueryChange = _a.onQueryChange, _b = _a.multiSelect, multiSelect = _b === void 0 ? false : _b;
    var handleChange = useCallback(function (change) {
        if (!change.value) {
            return;
        }
        var newQuery = __assign(__assign({}, query), { subscription: change.value });
        if (query.queryType === AzureQueryType.AzureMonitor) {
            newQuery.azureMonitor = __assign(__assign({}, newQuery.azureMonitor), { resourceGroup: undefined, metricDefinition: undefined, metricNamespace: undefined, resourceName: undefined, metricName: undefined, aggregation: undefined, timeGrain: '', dimensionFilters: [] });
        }
        onQueryChange(newQuery);
    }, [query, onQueryChange]);
    var onSubscriptionsChange = useCallback(function (change) {
        if (!change) {
            return;
        }
        query.subscriptions = change.map(function (c) { var _a; return (_a = c.value) !== null && _a !== void 0 ? _a : ''; });
        onQueryChange(query);
    }, [query, onQueryChange]);
    var options = useMemo(function () { return __spreadArray(__spreadArray([], __read(subscriptions), false), [variableOptionGroup], false); }, [subscriptions, variableOptionGroup]);
    return multiSelect ? (React.createElement(Field, { label: "Subscriptions" },
        React.createElement(MultiSelect, { menuShouldPortal: true, isClearable: true, value: findOptions(__spreadArray(__spreadArray([], __read(subscriptions), false), __read(variableOptionGroup.options), false), query.subscriptions), inputId: "azure-monitor-subscriptions-field", onChange: onSubscriptionsChange, options: options, width: 38 }))) : (React.createElement(Field, { label: "Subscription" },
        React.createElement(Select, { menuShouldPortal: true, value: query.subscription, inputId: "azure-monitor-subscriptions-field", onChange: handleChange, options: options, width: 38 })));
};
export default SubscriptionField;
//# sourceMappingURL=SubscriptionField.js.map