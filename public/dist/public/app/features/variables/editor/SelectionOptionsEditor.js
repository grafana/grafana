import React, { useCallback } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { VerticalGroup } from '@grafana/ui';
import { toKeyedVariableIdentifier } from '../utils';
import { VariableCheckboxField } from './VariableCheckboxField';
import { VariableTextField } from './VariableTextField';
export const SelectionOptionsEditor = ({ onMultiChanged: onMultiChangedProps, onPropChange, variable, }) => {
    var _a;
    const onMultiChanged = useCallback((event) => {
        onMultiChangedProps(toKeyedVariableIdentifier(variable), event.target.checked);
    }, [onMultiChangedProps, variable]);
    const onIncludeAllChanged = useCallback((event) => {
        onPropChange({ propName: 'includeAll', propValue: event.target.checked });
    }, [onPropChange]);
    const onAllValueChanged = useCallback((event) => {
        onPropChange({ propName: 'allValue', propValue: event.currentTarget.value });
    }, [onPropChange]);
    return (React.createElement(VerticalGroup, { spacing: "md", height: "inherit" },
        React.createElement(VariableCheckboxField, { value: variable.multi, name: "Multi-value", description: "Enables multiple values to be selected at the same time", onChange: onMultiChanged }),
        React.createElement(VariableCheckboxField, { value: variable.includeAll, name: "Include All option", description: "Enables an option to include all variables", onChange: onIncludeAllChanged }),
        variable.includeAll && (React.createElement(VariableTextField, { value: (_a = variable.allValue) !== null && _a !== void 0 ? _a : '', onChange: onAllValueChanged, name: "Custom all value", placeholder: "blank = auto", testId: selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInputV2 }))));
};
SelectionOptionsEditor.displayName = 'SelectionOptionsEditor';
//# sourceMappingURL=SelectionOptionsEditor.js.map