import { __awaiter } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { getDataSourceRef, LoadingState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getTemplateSrv } from '@grafana/runtime';
import { Field, Text } from '@grafana/ui';
import { Box } from '@grafana/ui/src/unstable';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { getTimeSrv } from '../../dashboard/services/TimeSrv';
import { SelectionOptionsEditor } from '../editor/SelectionOptionsEditor';
import { VariableLegend } from '../editor/VariableLegend';
import { VariableTextAreaField } from '../editor/VariableTextAreaField';
import { initialVariableEditorState } from '../editor/reducer';
import { getQueryVariableEditorState } from '../editor/selectors';
import { isLegacyQueryEditor, isQueryEditor } from '../guard';
import { changeVariableMultiValue } from '../state/actions';
import { getVariablesState } from '../state/selectors';
import { toKeyedVariableIdentifier } from '../utils';
import { QueryVariableRefreshSelect } from './QueryVariableRefreshSelect';
import { QueryVariableSortSelect } from './QueryVariableSortSelect';
import { changeQueryVariableDataSource, changeQueryVariableQuery, initQueryVariableEditor } from './actions';
const mapStateToProps = (state, ownProps) => {
    const { rootStateKey } = ownProps.variable;
    if (!rootStateKey) {
        console.error('QueryVariableEditor: variable has no rootStateKey');
        return {
            extended: getQueryVariableEditorState(initialVariableEditorState),
        };
    }
    const { editor } = getVariablesState(rootStateKey, state);
    return {
        extended: getQueryVariableEditorState(editor),
    };
};
const mapDispatchToProps = {
    initQueryVariableEditor,
    changeQueryVariableDataSource,
    changeQueryVariableQuery,
    changeVariableMultiValue,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export class QueryVariableEditorUnConnected extends PureComponent {
    constructor() {
        super(...arguments);
        this.state = {
            regex: null,
            tagsQuery: null,
            tagValuesQuery: null,
        };
        this.onDataSourceChange = (dsSettings) => {
            this.props.onPropChange({
                propName: 'datasource',
                propValue: dsSettings.isDefault ? null : getDataSourceRef(dsSettings),
            });
        };
        this.onLegacyQueryChange = (query, definition) => __awaiter(this, void 0, void 0, function* () {
            if (this.props.variable.query !== query) {
                this.props.changeQueryVariableQuery(toKeyedVariableIdentifier(this.props.variable), query, definition);
            }
        });
        this.onQueryChange = (query) => __awaiter(this, void 0, void 0, function* () {
            if (this.props.variable.query !== query) {
                let definition = '';
                if (query && query.hasOwnProperty('query') && typeof query.query === 'string') {
                    definition = query.query;
                }
                this.props.changeQueryVariableQuery(toKeyedVariableIdentifier(this.props.variable), query, definition);
            }
        });
        this.onRegExChange = (event) => {
            this.setState({ regex: event.currentTarget.value });
        };
        this.onRegExBlur = (event) => __awaiter(this, void 0, void 0, function* () {
            const regex = event.currentTarget.value;
            if (this.props.variable.regex !== regex) {
                this.props.onPropChange({ propName: 'regex', propValue: regex, updateOptions: true });
            }
        });
        this.onRefreshChange = (option) => {
            this.props.onPropChange({ propName: 'refresh', propValue: option });
        };
        this.onSortChange = (option) => __awaiter(this, void 0, void 0, function* () {
            this.props.onPropChange({ propName: 'sort', propValue: option.value, updateOptions: true });
        });
        this.onSelectionOptionsChange = ({ propValue, propName }) => __awaiter(this, void 0, void 0, function* () {
            this.props.onPropChange({ propName, propValue, updateOptions: true });
        });
        this.renderQueryEditor = () => {
            var _a, _b, _c, _d, _e;
            const { extended, variable } = this.props;
            if (!extended || !extended.dataSource || !extended.VariableQueryEditor) {
                return null;
            }
            const datasource = extended.dataSource;
            const VariableQueryEditor = extended.VariableQueryEditor;
            let query = variable.query;
            if (typeof query === 'string') {
                query = query || ((_c = (_b = (_a = datasource.variables) === null || _a === void 0 ? void 0 : _a.getDefaultQuery) === null || _b === void 0 ? void 0 : _b.call(_a)) !== null && _c !== void 0 ? _c : '');
            }
            else {
                query = Object.assign(Object.assign({}, (_e = (_d = datasource.variables) === null || _d === void 0 ? void 0 : _d.getDefaultQuery) === null || _e === void 0 ? void 0 : _e.call(_d)), variable.query);
            }
            if (isLegacyQueryEditor(VariableQueryEditor, datasource)) {
                return (React.createElement(Box, { marginBottom: 2 },
                    React.createElement(Text, { element: 'h4' }, "Query"),
                    React.createElement(Box, { marginTop: 1 },
                        React.createElement(VariableQueryEditor, { key: datasource.uid, datasource: datasource, query: query, templateSrv: getTemplateSrv(), onChange: this.onLegacyQueryChange }))));
            }
            const range = getTimeSrv().timeRange();
            if (isQueryEditor(VariableQueryEditor, datasource)) {
                return (React.createElement(Box, { marginBottom: 2 },
                    React.createElement(Text, { element: 'h4' }, "Query"),
                    React.createElement(Box, { marginTop: 1 },
                        React.createElement(VariableQueryEditor, { key: datasource.uid, datasource: datasource, query: query, onChange: this.onQueryChange, onRunQuery: () => { }, data: { series: [], state: LoadingState.Done, timeRange: range }, range: range, onBlur: () => { }, history: [] }))));
            }
            return null;
        };
    }
    componentDidMount() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.props.initQueryVariableEditor(toKeyedVariableIdentifier(this.props.variable));
        });
    }
    componentDidUpdate(prevProps) {
        if (prevProps.variable.datasource !== this.props.variable.datasource) {
            this.props.changeQueryVariableDataSource(toKeyedVariableIdentifier(this.props.variable), this.props.variable.datasource);
        }
    }
    render() {
        var _a;
        return (React.createElement(React.Fragment, null,
            React.createElement(VariableLegend, null, "Query options"),
            React.createElement(Field, { label: "Data source", htmlFor: "data-source-picker" },
                React.createElement(DataSourcePicker, { current: this.props.variable.datasource, onChange: this.onDataSourceChange, variables: true, width: 30 })),
            this.renderQueryEditor(),
            React.createElement(VariableTextAreaField, { value: (_a = this.state.regex) !== null && _a !== void 0 ? _a : this.props.variable.regex, name: "Regex", description: React.createElement("div", null,
                    "Optional, if you want to extract part of a series name or metric node segment.",
                    React.createElement("br", null),
                    "Named capture groups can be used to separate the display text and value (",
                    React.createElement("a", { className: "external-link", href: "https://grafana.com/docs/grafana/latest/variables/filter-variables-with-regex#filter-and-modify-using-named-text-and-value-capture-groups", target: "__blank" }, "see examples"),
                    ")."), placeholder: "/.*-(?<text>.*)-(?<value>.*)-.*/", onChange: this.onRegExChange, onBlur: this.onRegExBlur, testId: selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRegExInputV2, width: 52 }),
            React.createElement(QueryVariableSortSelect, { onChange: this.onSortChange, sort: this.props.variable.sort }),
            React.createElement(QueryVariableRefreshSelect, { onChange: this.onRefreshChange, refresh: this.props.variable.refresh }),
            React.createElement(VariableLegend, null, "Selection options"),
            React.createElement(SelectionOptionsEditor, { variable: this.props.variable, onPropChange: this.onSelectionOptionsChange, onMultiChanged: this.props.changeVariableMultiValue })));
    }
}
export const QueryVariableEditor = connector(QueryVariableEditorUnConnected);
//# sourceMappingURL=QueryVariableEditor.js.map