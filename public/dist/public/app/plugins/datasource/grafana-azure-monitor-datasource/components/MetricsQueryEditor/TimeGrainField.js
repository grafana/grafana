import { __assign, __read, __spreadArray } from "tslib";
import React, { useCallback, useMemo } from 'react';
import { Select } from '@grafana/ui';
import { Field } from '../Field';
import TimegrainConverter from '../../time_grain_converter';
import { setTimeGrain } from './setQueryValue';
var TimeGrainField = function (_a) {
    var _b;
    var query = _a.query, timeGrainOptions = _a.timeGrainOptions, variableOptionGroup = _a.variableOptionGroup, onQueryChange = _a.onQueryChange;
    var handleChange = useCallback(function (change) {
        if (!change.value) {
            return;
        }
        var newQuery = setTimeGrain(query, change.value);
        onQueryChange(newQuery);
    }, [onQueryChange, query]);
    var timeGrains = useMemo(function () {
        var autoInterval = TimegrainConverter.findClosestTimeGrain('1m', timeGrainOptions.map(function (o) { return TimegrainConverter.createKbnUnitFromISO8601Duration(o.value); }) || [
            '1m',
            '5m',
            '15m',
            '30m',
            '1h',
            '6h',
            '12h',
            '1d',
        ]);
        var baseTimeGrains = timeGrainOptions.map(function (v) { return (v.value === 'auto' ? __assign(__assign({}, v), { description: autoInterval }) : v); });
        return __spreadArray(__spreadArray([], __read(baseTimeGrains), false), [variableOptionGroup], false);
    }, [timeGrainOptions, variableOptionGroup]);
    return (React.createElement(Field, { label: "Time grain" },
        React.createElement(Select, { menuShouldPortal: true, inputId: "azure-monitor-metrics-time-grain-field", value: (_b = query.azureMonitor) === null || _b === void 0 ? void 0 : _b.timeGrain, onChange: handleChange, options: timeGrains, width: 38 })));
};
export default TimeGrainField;
//# sourceMappingURL=TimeGrainField.js.map