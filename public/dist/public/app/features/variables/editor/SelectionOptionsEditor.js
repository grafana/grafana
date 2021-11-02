import React, { useCallback } from 'react';
import { InlineFieldRow, VerticalGroup } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { toVariableIdentifier } from '../state/types';
import { VariableSectionHeader } from './VariableSectionHeader';
import { VariableSwitchField } from './VariableSwitchField';
import { VariableTextField } from './VariableTextField';
export var SelectionOptionsEditor = function (_a) {
    var _b;
    var onMultiChangedProps = _a.onMultiChanged, onPropChange = _a.onPropChange, variable = _a.variable;
    var onMultiChanged = useCallback(function (event) {
        onMultiChangedProps(toVariableIdentifier(variable), event.target.checked);
    }, [onMultiChangedProps, variable]);
    var onIncludeAllChanged = useCallback(function (event) {
        onPropChange({ propName: 'includeAll', propValue: event.target.checked });
    }, [onPropChange]);
    var onAllValueChanged = useCallback(function (event) {
        onPropChange({ propName: 'allValue', propValue: event.currentTarget.value });
    }, [onPropChange]);
    return (React.createElement(VerticalGroup, { spacing: "none" },
        React.createElement(VariableSectionHeader, { name: "Selection options" }),
        React.createElement(InlineFieldRow, null,
            React.createElement(VariableSwitchField, { value: variable.multi, name: "Multi-value", tooltip: "Enables multiple values to be selected at the same time", onChange: onMultiChanged, ariaLabel: selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitch })),
        React.createElement(InlineFieldRow, null,
            React.createElement(VariableSwitchField, { value: variable.includeAll, name: "Include All option", tooltip: "Enables an option to include all variables", onChange: onIncludeAllChanged, ariaLabel: selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch })),
        variable.includeAll && (React.createElement(InlineFieldRow, null,
            React.createElement(VariableTextField, { value: (_b = variable.allValue) !== null && _b !== void 0 ? _b : '', onChange: onAllValueChanged, name: "Custom all value", placeholder: "blank = auto", ariaLabel: selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput, labelWidth: 20 })))));
};
SelectionOptionsEditor.displayName = 'SelectionOptionsEditor';
//# sourceMappingURL=SelectionOptionsEditor.js.map