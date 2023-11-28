import React, { useMemo } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { VariableSelectField } from '../editor/VariableSelectField';
import { getVariableTypes } from '../utils';
export function VariableTypeSelect({ onChange, type }) {
    const options = useMemo(() => getVariableTypes(), []);
    const value = useMemo(() => { var _a; return (_a = options.find((o) => o.value === type)) !== null && _a !== void 0 ? _a : options[0]; }, [options, type]);
    return (React.createElement(VariableSelectField, { name: "Select variable type", value: value, options: options, onChange: onChange, testId: selectors.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelectV2 }));
}
//# sourceMappingURL=VariableTypeSelect.js.map