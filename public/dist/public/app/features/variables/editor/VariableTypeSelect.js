import React, { useMemo } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { VariableSelectField } from '../editor/VariableSelectField';
import { getVariableTypes } from '../utils';
import { variableAdapters } from '../adapters';
export function VariableTypeSelect(_a) {
    var onChange = _a.onChange, type = _a.type;
    var options = useMemo(function () { return getVariableTypes(); }, []);
    var value = useMemo(function () { var _a; return (_a = options.find(function (o) { return o.value === type; })) !== null && _a !== void 0 ? _a : options[0]; }, [options, type]);
    return (React.createElement(VariableSelectField, { name: "Type", value: value, options: options, onChange: onChange, tooltip: variableAdapters.get(type).description, ariaLabel: selectors.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelect }));
}
//# sourceMappingURL=VariableTypeSelect.js.map