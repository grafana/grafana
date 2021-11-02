import { __read, __spreadArray } from "tslib";
import React, { useCallback, useMemo } from 'react';
import { Select } from '@grafana/ui';
import { Field } from '../Field';
import { setFormatAs } from './setQueryValue';
var FORMAT_OPTIONS = [
    { label: 'Time series', value: 'time_series' },
    { label: 'Table', value: 'table' },
];
var FormatAsField = function (_a) {
    var _b;
    var query = _a.query, variableOptionGroup = _a.variableOptionGroup, onQueryChange = _a.onQueryChange;
    var options = useMemo(function () { return __spreadArray(__spreadArray([], __read(FORMAT_OPTIONS), false), [variableOptionGroup], false); }, [variableOptionGroup]);
    var handleChange = useCallback(function (change) {
        var value = change.value;
        if (!value) {
            return;
        }
        var newQuery = setFormatAs(query, value);
        onQueryChange(newQuery);
    }, [onQueryChange, query]);
    return (React.createElement(Field, { label: "Format as" },
        React.createElement(Select, { menuShouldPortal: true, inputId: "azure-monitor-logs-workspaces-field", value: (_b = query.azureLogAnalytics) === null || _b === void 0 ? void 0 : _b.resultFormat, onChange: handleChange, options: options, width: 38 })));
};
export default FormatAsField;
//# sourceMappingURL=FormatAsField.js.map