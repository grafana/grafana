import React, { useCallback } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { VariableLegend } from '../editor/VariableLegend';
import { VariableTextField } from '../editor/VariableTextField';
export function TextBoxVariableEditor({ onPropChange, variable: { query } }) {
    const updateVariable = useCallback((event, updateOptions) => {
        event.preventDefault();
        onPropChange({ propName: 'originalQuery', propValue: event.currentTarget.value, updateOptions: false });
        onPropChange({ propName: 'query', propValue: event.currentTarget.value, updateOptions });
    }, [onPropChange]);
    const onChange = useCallback((e) => updateVariable(e, false), [updateVariable]);
    const onBlur = useCallback((e) => updateVariable(e, true), [updateVariable]);
    return (React.createElement(React.Fragment, null,
        React.createElement(VariableLegend, null, "Text options"),
        React.createElement(VariableTextField, { value: query, name: "Default value", placeholder: "default value, if any", onChange: onChange, onBlur: onBlur, width: 30, testId: selectors.pages.Dashboard.Settings.Variables.Edit.TextBoxVariable.textBoxOptionsQueryInputV2 })));
}
//# sourceMappingURL=TextBoxVariableEditor.js.map