import { __awaiter } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { selectors } from '@grafana/e2e-selectors';
import { SelectionOptionsEditor } from '../editor/SelectionOptionsEditor';
import { VariableLegend } from '../editor/VariableLegend';
import { VariableSelectField } from '../editor/VariableSelectField';
import { VariableTextField } from '../editor/VariableTextField';
import { initialVariableEditorState } from '../editor/reducer';
import { getDatasourceVariableEditorState } from '../editor/selectors';
import { changeVariableMultiValue } from '../state/actions';
import { getVariablesState } from '../state/selectors';
import { initDataSourceVariableEditor } from './actions';
const mapStateToProps = (state, ownProps) => {
    const { variable: { rootStateKey }, } = ownProps;
    if (!rootStateKey) {
        console.error('DataSourceVariableEditor: variable has no rootStateKey');
        return {
            extended: getDatasourceVariableEditorState(initialVariableEditorState),
        };
    }
    const { editor } = getVariablesState(rootStateKey, state);
    return {
        extended: getDatasourceVariableEditorState(editor),
    };
};
const mapDispatchToProps = {
    initDataSourceVariableEditor,
    changeVariableMultiValue,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export class DataSourceVariableEditorUnConnected extends PureComponent {
    constructor() {
        super(...arguments);
        this.onRegExChange = (event) => {
            this.props.onPropChange({
                propName: 'regex',
                propValue: event.currentTarget.value,
            });
        };
        this.onRegExBlur = (event) => {
            this.props.onPropChange({
                propName: 'regex',
                propValue: event.currentTarget.value,
                updateOptions: true,
            });
        };
        this.onSelectionOptionsChange = ({ propValue, propName }) => __awaiter(this, void 0, void 0, function* () {
            this.props.onPropChange({ propName, propValue, updateOptions: true });
        });
        this.getSelectedDataSourceTypeValue = () => {
            const { extended } = this.props;
            if (!(extended === null || extended === void 0 ? void 0 : extended.dataSourceTypes.length)) {
                return '';
            }
            const foundItem = extended.dataSourceTypes.find((ds) => ds.value === this.props.variable.query);
            const value = foundItem ? foundItem.value : extended.dataSourceTypes[0].value;
            return value !== null && value !== void 0 ? value : '';
        };
        this.onDataSourceTypeChanged = (option) => {
            this.props.onPropChange({ propName: 'query', propValue: option.value, updateOptions: true });
        };
    }
    componentDidMount() {
        const { rootStateKey } = this.props.variable;
        if (!rootStateKey) {
            console.error('DataSourceVariableEditor: variable has no rootStateKey');
            return;
        }
        this.props.initDataSourceVariableEditor(rootStateKey);
    }
    render() {
        var _a, _b, _c;
        const { variable, extended, changeVariableMultiValue } = this.props;
        const typeOptions = ((_a = extended === null || extended === void 0 ? void 0 : extended.dataSourceTypes) === null || _a === void 0 ? void 0 : _a.length)
            ? (_b = extended.dataSourceTypes) === null || _b === void 0 ? void 0 : _b.map((ds) => { var _a; return ({ value: (_a = ds.value) !== null && _a !== void 0 ? _a : '', label: ds.text }); })
            : [];
        const typeValue = (_c = typeOptions.find((o) => o.value === variable.query)) !== null && _c !== void 0 ? _c : typeOptions[0];
        return (React.createElement(React.Fragment, null,
            React.createElement(VariableLegend, null, "Data source options"),
            React.createElement(VariableSelectField, { name: "Type", value: typeValue, options: typeOptions, onChange: this.onDataSourceTypeChanged, testId: selectors.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.datasourceSelect }),
            React.createElement(VariableTextField, { value: this.props.variable.regex, name: "Instance name filter", placeholder: "/.*-(.*)-.*/", onChange: this.onRegExChange, onBlur: this.onRegExBlur, description: React.createElement("div", null,
                    "Regex filter for which data source instances to choose from in the variable value list. Leave empty for all.",
                    React.createElement("br", null),
                    React.createElement("br", null),
                    "Example: ",
                    React.createElement("code", null, "/^prod/")) }),
            React.createElement(VariableLegend, null, "Selection options"),
            React.createElement(SelectionOptionsEditor, { variable: variable, onPropChange: this.onSelectionOptionsChange, onMultiChanged: changeVariableMultiValue })));
    }
}
export const DataSourceVariableEditor = connector(DataSourceVariableEditorUnConnected);
//# sourceMappingURL=DataSourceVariableEditor.js.map