import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { getDataSourceRef } from '@grafana/data';
import { Alert, Field } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { VariableLegend } from '../editor/VariableLegend';
import { initialVariableEditorState } from '../editor/reducer';
import { getAdhocVariableEditorState } from '../editor/selectors';
import { getVariablesState } from '../state/selectors';
import { toKeyedVariableIdentifier } from '../utils';
import { changeVariableDatasource } from './actions';
const mapStateToProps = (state, ownProps) => {
    const { rootStateKey } = ownProps.variable;
    if (!rootStateKey) {
        console.error('AdHocVariableEditor: variable has no rootStateKey');
        return {
            extended: getAdhocVariableEditorState(initialVariableEditorState),
        };
    }
    const { editor } = getVariablesState(rootStateKey, state);
    return {
        extended: getAdhocVariableEditorState(editor),
    };
};
const mapDispatchToProps = {
    changeVariableDatasource,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export class AdHocVariableEditorUnConnected extends PureComponent {
    constructor() {
        super(...arguments);
        this.onDatasourceChanged = (ds) => {
            this.props.changeVariableDatasource(toKeyedVariableIdentifier(this.props.variable), getDataSourceRef(ds));
        };
    }
    componentDidMount() {
        const { rootStateKey } = this.props.variable;
        if (!rootStateKey) {
            console.error('AdHocVariableEditor: variable has no rootStateKey');
            return;
        }
    }
    render() {
        var _a;
        const { variable, extended } = this.props;
        const infoText = (_a = extended === null || extended === void 0 ? void 0 : extended.infoText) !== null && _a !== void 0 ? _a : null;
        return (React.createElement(React.Fragment, null,
            React.createElement(VariableLegend, null, "Ad-hoc options"),
            React.createElement(Field, { label: "Data source", htmlFor: "data-source-picker" },
                React.createElement(DataSourcePicker, { current: variable.datasource, onChange: this.onDatasourceChanged, width: 30, variables: true, noDefault: true })),
            infoText ? React.createElement(Alert, { title: infoText, severity: "info" }) : null));
    }
}
export const AdHocVariableEditor = connector(AdHocVariableEditorUnConnected);
//# sourceMappingURL=AdHocVariableEditor.js.map