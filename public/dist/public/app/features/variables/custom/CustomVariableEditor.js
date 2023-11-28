import { __awaiter } from "tslib";
import React, { PureComponent } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { connectWithStore } from 'app/core/utils/connectWithReduxStore';
import { SelectionOptionsEditor } from '../editor/SelectionOptionsEditor';
import { VariableLegend } from '../editor/VariableLegend';
import { VariableTextAreaField } from '../editor/VariableTextAreaField';
import { changeVariableMultiValue } from '../state/actions';
class CustomVariableEditorUnconnected extends PureComponent {
    constructor() {
        super(...arguments);
        this.onChange = (event) => {
            this.props.onPropChange({
                propName: 'query',
                propValue: event.currentTarget.value,
            });
        };
        this.onSelectionOptionsChange = ({ propName, propValue }) => __awaiter(this, void 0, void 0, function* () {
            this.props.onPropChange({ propName, propValue, updateOptions: true });
        });
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
            React.createElement(VariableLegend, null, "Custom options"),
            React.createElement(VariableTextAreaField, { name: "Values separated by comma", value: this.props.variable.query, placeholder: "1, 10, mykey : myvalue, myvalue, escaped\\,value", onChange: this.onChange, onBlur: this.onBlur, required: true, width: 52, testId: selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput }),
            React.createElement(VariableLegend, null, "Selection options"),
            React.createElement(SelectionOptionsEditor, { variable: this.props.variable, onPropChange: this.onSelectionOptionsChange, onMultiChanged: this.props.changeVariableMultiValue })));
    }
}
const mapStateToProps = (state, ownProps) => ({});
const mapDispatchToProps = {
    changeVariableMultiValue,
};
export const CustomVariableEditor = connectWithStore(CustomVariableEditorUnconnected, mapStateToProps, mapDispatchToProps);
//# sourceMappingURL=CustomVariableEditor.js.map