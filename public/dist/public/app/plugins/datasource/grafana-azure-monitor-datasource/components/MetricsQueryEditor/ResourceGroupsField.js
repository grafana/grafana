import { __read, __spreadArray } from "tslib";
import React, { useCallback, useMemo } from 'react';
import { Select } from '@grafana/ui';
import { Field } from '../Field';
import { setResourceGroup } from './setQueryValue';
var ResourceGroupsField = function (_a) {
    var _b;
    var query = _a.query, resourceGroups = _a.resourceGroups, variableOptionGroup = _a.variableOptionGroup, onQueryChange = _a.onQueryChange, setError = _a.setError;
    var handleChange = useCallback(function (change) {
        var newQuery = setResourceGroup(query, change.value);
        onQueryChange(newQuery);
    }, [onQueryChange, query]);
    var options = useMemo(function () { return __spreadArray(__spreadArray([], __read(resourceGroups), false), [variableOptionGroup], false); }, [resourceGroups, variableOptionGroup]);
    return (React.createElement(Field, { label: "Resource group" },
        React.createElement(Select, { menuShouldPortal: true, inputId: "azure-monitor-metrics-resource-group-field", value: (_b = query.azureMonitor) === null || _b === void 0 ? void 0 : _b.resourceGroup, onChange: handleChange, options: options, width: 38 })));
};
export default ResourceGroupsField;
//# sourceMappingURL=ResourceGroupsField.js.map