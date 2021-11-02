import { __read, __spreadArray } from "tslib";
import React, { useCallback, useMemo } from 'react';
import { Select } from '@grafana/ui';
import { Field } from '../Field';
import { setResourceName } from './setQueryValue';
var ResourceNameField = function (_a) {
    var _b, _c;
    var resourceNames = _a.resourceNames, query = _a.query, variableOptionGroup = _a.variableOptionGroup, onQueryChange = _a.onQueryChange;
    var handleChange = useCallback(function (change) {
        var newQuery = setResourceName(query, change.value);
        onQueryChange(newQuery);
    }, [onQueryChange, query]);
    var options = useMemo(function () { return __spreadArray(__spreadArray([], __read(resourceNames), false), [variableOptionGroup], false); }, [resourceNames, variableOptionGroup]);
    var value = (_c = (_b = query.azureMonitor) === null || _b === void 0 ? void 0 : _b.resourceName) !== null && _c !== void 0 ? _c : null;
    return (React.createElement(Field, { label: "Resource name" },
        React.createElement(Select, { menuShouldPortal: true, inputId: "azure-monitor-metrics-resource-name-field", value: value, onChange: handleChange, options: options, width: 38 })));
};
export default ResourceNameField;
//# sourceMappingURL=ResourceNameField.js.map