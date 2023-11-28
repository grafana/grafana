import React, { PureComponent } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { VariableLegend } from '../editor/VariableLegend';
import { VariableTextField } from '../editor/VariableTextField';
export class ConstantVariableEditor extends PureComponent {
    constructor() {
        super(...arguments);
        this.onChange = (event) => {
            this.props.onPropChange({
                propName: 'query',
                propValue: event.currentTarget.value,
            });
        };
        this.onBlur = (event) => {
            this.props.onPropChange({
                propName: 'query',
                propValue: event.currentTarget.value,
                updateOptions: true,
            });
        };
    }
    render() {
        return (React.createElement(React.Fragment, null,
            React.createElement(VariableLegend, null, "Constant options"),
            React.createElement(VariableTextField, { value: this.props.variable.query, name: "Value", placeholder: "your metric prefix", onChange: this.onChange, onBlur: this.onBlur, testId: selectors.pages.Dashboard.Settings.Variables.Edit.ConstantVariable.constantOptionsQueryInputV2, width: 30 })));
    }
}
//# sourceMappingURL=ConstantVariableEditor.js.map