import { __awaiter, __extends, __generator, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { css } from '@emotion/css';
import { InlineField, InlineFieldRow, VerticalGroup } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { DataSourcePicker, getTemplateSrv } from '@grafana/runtime';
import { LoadingState } from '@grafana/data';
import { SelectionOptionsEditor } from '../editor/SelectionOptionsEditor';
import { changeQueryVariableDataSource, changeQueryVariableQuery, initQueryVariableEditor } from './actions';
import { toVariableIdentifier } from '../state/types';
import { changeVariableMultiValue } from '../state/actions';
import { getTimeSrv } from '../../dashboard/services/TimeSrv';
import { isLegacyQueryEditor, isQueryEditor } from '../guard';
import { VariableSectionHeader } from '../editor/VariableSectionHeader';
import { VariableTextField } from '../editor/VariableTextField';
import { QueryVariableRefreshSelect } from './QueryVariableRefreshSelect';
import { QueryVariableSortSelect } from './QueryVariableSortSelect';
var mapStateToProps = function (state) { return ({
    editor: state.templating.editor,
}); };
var mapDispatchToProps = {
    initQueryVariableEditor: initQueryVariableEditor,
    changeQueryVariableDataSource: changeQueryVariableDataSource,
    changeQueryVariableQuery: changeQueryVariableQuery,
    changeVariableMultiValue: changeVariableMultiValue,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
var QueryVariableEditorUnConnected = /** @class */ (function (_super) {
    __extends(QueryVariableEditorUnConnected, _super);
    function QueryVariableEditorUnConnected() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            regex: null,
            tagsQuery: null,
            tagValuesQuery: null,
        };
        _this.onDataSourceChange = function (dsSettings) {
            _this.props.onPropChange({
                propName: 'datasource',
                propValue: dsSettings.isDefault ? null : dsSettings.name,
            });
        };
        _this.onLegacyQueryChange = function (query, definition) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (this.props.variable.query !== query) {
                    this.props.changeQueryVariableQuery(toVariableIdentifier(this.props.variable), query, definition);
                }
                return [2 /*return*/];
            });
        }); };
        _this.onQueryChange = function (query) { return __awaiter(_this, void 0, void 0, function () {
            var definition;
            return __generator(this, function (_a) {
                if (this.props.variable.query !== query) {
                    definition = '';
                    if (query && query.hasOwnProperty('query') && typeof query.query === 'string') {
                        definition = query.query;
                    }
                    this.props.changeQueryVariableQuery(toVariableIdentifier(this.props.variable), query, definition);
                }
                return [2 /*return*/];
            });
        }); };
        _this.onRegExChange = function (event) {
            _this.setState({ regex: event.currentTarget.value });
        };
        _this.onRegExBlur = function (event) { return __awaiter(_this, void 0, void 0, function () {
            var regex;
            return __generator(this, function (_a) {
                regex = event.currentTarget.value;
                if (this.props.variable.regex !== regex) {
                    this.props.onPropChange({ propName: 'regex', propValue: regex, updateOptions: true });
                }
                return [2 /*return*/];
            });
        }); };
        _this.onRefreshChange = function (option) {
            _this.props.onPropChange({ propName: 'refresh', propValue: option.value });
        };
        _this.onSortChange = function (option) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.props.onPropChange({ propName: 'sort', propValue: option.value, updateOptions: true });
                return [2 /*return*/];
            });
        }); };
        _this.onSelectionOptionsChange = function (_a) {
            var propValue = _a.propValue, propName = _a.propName;
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_b) {
                    this.props.onPropChange({ propName: propName, propValue: propValue, updateOptions: true });
                    return [2 /*return*/];
                });
            });
        };
        _this.renderQueryEditor = function () {
            var _a = _this.props, editor = _a.editor, variable = _a.variable;
            if (!editor.extended || !editor.extended.dataSource || !editor.extended.VariableQueryEditor) {
                return null;
            }
            var query = variable.query;
            var datasource = editor.extended.dataSource;
            var VariableQueryEditor = editor.extended.VariableQueryEditor;
            if (isLegacyQueryEditor(VariableQueryEditor, datasource)) {
                return (React.createElement(VariableQueryEditor, { datasource: datasource, query: query, templateSrv: getTemplateSrv(), onChange: _this.onLegacyQueryChange }));
            }
            var range = getTimeSrv().timeRange();
            if (isQueryEditor(VariableQueryEditor, datasource)) {
                return (React.createElement(VariableQueryEditor, { datasource: datasource, query: query, onChange: _this.onQueryChange, onRunQuery: function () { }, data: { series: [], state: LoadingState.Done, timeRange: range }, range: range, onBlur: function () { }, history: [] }));
            }
            return null;
        };
        return _this;
    }
    QueryVariableEditorUnConnected.prototype.componentDidMount = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.props.initQueryVariableEditor(toVariableIdentifier(this.props.variable))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    QueryVariableEditorUnConnected.prototype.componentDidUpdate = function (prevProps) {
        if (prevProps.variable.datasource !== this.props.variable.datasource) {
            this.props.changeQueryVariableDataSource(toVariableIdentifier(this.props.variable), this.props.variable.datasource);
        }
    };
    QueryVariableEditorUnConnected.prototype.render = function () {
        var _a;
        return (React.createElement(VerticalGroup, { spacing: "xs" },
            React.createElement(VariableSectionHeader, { name: "Query Options" }),
            React.createElement(VerticalGroup, { spacing: "lg" },
                React.createElement(VerticalGroup, { spacing: "none" },
                    React.createElement(InlineFieldRow, null,
                        React.createElement(InlineField, { label: "Data source", labelWidth: 20, htmlFor: "data-source-picker" },
                            React.createElement(DataSourcePicker, { current: this.props.variable.datasource, onChange: this.onDataSourceChange, variables: true })),
                        React.createElement(QueryVariableRefreshSelect, { onChange: this.onRefreshChange, refresh: this.props.variable.refresh })),
                    React.createElement("div", { className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n                flex-direction: column;\n                width: 100%;\n              "], ["\n                flex-direction: column;\n                width: 100%;\n              "]))) }, this.renderQueryEditor()),
                    React.createElement(VariableTextField, { value: (_a = this.state.regex) !== null && _a !== void 0 ? _a : this.props.variable.regex, name: "Regex", placeholder: "/.*-(?<text>.*)-(?<value>.*)-.*/", onChange: this.onRegExChange, onBlur: this.onRegExBlur, labelWidth: 20, tooltip: React.createElement("div", null,
                            "Optional, if you want to extract part of a series name or metric node segment. Named capture groups can be used to separate the display text and value (",
                            React.createElement("a", { href: "https://grafana.com/docs/grafana/latest/variables/filter-variables-with-regex#filter-and-modify-using-named-text-and-value-capture-groups", target: "__blank" }, "see examples"),
                            ")."), ariaLabel: selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRegExInput, grow: true }),
                    React.createElement(QueryVariableSortSelect, { onChange: this.onSortChange, sort: this.props.variable.sort })),
                React.createElement(SelectionOptionsEditor, { variable: this.props.variable, onPropChange: this.onSelectionOptionsChange, onMultiChanged: this.props.changeVariableMultiValue }))));
    };
    return QueryVariableEditorUnConnected;
}(PureComponent));
export { QueryVariableEditorUnConnected };
export var QueryVariableEditor = connector(QueryVariableEditorUnConnected);
var templateObject_1;
//# sourceMappingURL=QueryVariableEditor.js.map