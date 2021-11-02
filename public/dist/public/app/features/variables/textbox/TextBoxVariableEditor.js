import React, { useCallback } from 'react';
import { VerticalGroup } from '@grafana/ui';
import { VariableSectionHeader } from '../editor/VariableSectionHeader';
import { VariableTextField } from '../editor/VariableTextField';
import { selectors } from '@grafana/e2e-selectors';
export function TextBoxVariableEditor(_a) {
    var onPropChange = _a.onPropChange, query = _a.variable.query;
    var updateVariable = useCallback(function (event, updateOptions) {
        event.preventDefault();
        onPropChange({ propName: 'originalQuery', propValue: event.currentTarget.value, updateOptions: false });
        onPropChange({ propName: 'query', propValue: event.currentTarget.value, updateOptions: updateOptions });
    }, [onPropChange]);
    var onChange = useCallback(function (e) { return updateVariable(e, false); }, [updateVariable]);
    var onBlur = useCallback(function (e) { return updateVariable(e, true); }, [updateVariable]);
    return (React.createElement(VerticalGroup, { spacing: "xs" },
        React.createElement(VariableSectionHeader, { name: "Text options" }),
        React.createElement(VariableTextField, { value: query, name: "Default value", placeholder: "default value, if any", onChange: onChange, onBlur: onBlur, labelWidth: 20, grow: true, ariaLabel: selectors.pages.Dashboard.Settings.Variables.Edit.TextBoxVariable.textBoxOptionsQueryInput })));
}
//# sourceMappingURL=TextBoxVariableEditor.js.map