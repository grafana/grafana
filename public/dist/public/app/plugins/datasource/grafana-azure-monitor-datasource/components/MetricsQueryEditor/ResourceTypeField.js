import { __read, __spreadArray } from "tslib";
import React, { useCallback, useMemo } from 'react';
import { Select } from '@grafana/ui';
import { Field } from '../Field';
import { setResourceType } from './setQueryValue';
var NamespaceField = function (_a) {
    var _b;
    var resourceTypes = _a.resourceTypes, query = _a.query, variableOptionGroup = _a.variableOptionGroup, onQueryChange = _a.onQueryChange;
    var handleChange = useCallback(function (change) {
        if (!change.value) {
            return;
        }
        var newQuery = setResourceType(query, change.value);
        onQueryChange(newQuery);
    }, [onQueryChange, query]);
    var options = useMemo(function () { return __spreadArray(__spreadArray([], __read(resourceTypes), false), [variableOptionGroup], false); }, [resourceTypes, variableOptionGroup]);
    return (React.createElement(Field, { label: "Resource type" },
        React.createElement(Select, { menuShouldPortal: true, inputId: "azure-monitor-metrics-resource-type-field", value: (_b = query.azureMonitor) === null || _b === void 0 ? void 0 : _b.metricDefinition, onChange: handleChange, options: options, width: 38 })));
};
export default NamespaceField;
//# sourceMappingURL=ResourceTypeField.js.map