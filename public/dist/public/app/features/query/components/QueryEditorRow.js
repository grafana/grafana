import { __assign, __awaiter, __extends, __generator } from "tslib";
// Libraries
import React, { PureComponent } from 'react';
import classNames from 'classnames';
import { cloneDeep, has } from 'lodash';
// Utils & Services
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getAngularLoader } from '@grafana/runtime';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { ErrorBoundaryAlert, HorizontalGroup } from '@grafana/ui';
import { CoreApp, EventBusSrv, LoadingState, PanelEvents, toLegacyResponseData, } from '@grafana/data';
import { QueryEditorRowHeader } from './QueryEditorRowHeader';
import { QueryOperationRow, } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { QueryOperationAction } from 'app/core/components/QueryOperationRow/QueryOperationAction';
import { selectors } from '@grafana/e2e-selectors';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { OperationRowHelp } from 'app/core/components/QueryOperationRow/OperationRowHelp';
import { RowActionComponents } from './QueryActionComponent';
var QueryEditorRow = /** @class */ (function (_super) {
    __extends(QueryEditorRow, _super);
    function QueryEditorRow() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.element = null;
        _this.angularScope = null;
        _this.angularQueryEditor = null;
        _this.state = {
            datasource: null,
            hasTextEditMode: false,
            data: undefined,
            isOpen: true,
            showingHelp: false,
        };
        _this.renderAngularQueryEditor = function () {
            if (!_this.element) {
                return;
            }
            if (_this.angularQueryEditor) {
                _this.angularQueryEditor.destroy();
                _this.angularQueryEditor = null;
            }
            var loader = getAngularLoader();
            var template = '<plugin-component type="query-ctrl" />';
            var scopeProps = { ctrl: _this.getAngularQueryComponentScope() };
            _this.angularQueryEditor = loader.load(_this.element, scopeProps, template);
            _this.angularScope = scopeProps.ctrl;
        };
        _this.onOpen = function () {
            _this.renderAngularQueryEditor();
        };
        _this.renderPluginEditor = function () {
            var _a;
            var _b = _this.props, query = _b.query, onChange = _b.onChange, queries = _b.queries, onRunQuery = _b.onRunQuery, _c = _b.app, app = _c === void 0 ? CoreApp.PanelEditor : _c, history = _b.history;
            var _d = _this.state, datasource = _d.datasource, data = _d.data;
            if ((_a = datasource === null || datasource === void 0 ? void 0 : datasource.components) === null || _a === void 0 ? void 0 : _a.QueryCtrl) {
                return React.createElement("div", { ref: function (element) { return (_this.element = element); } });
            }
            if (datasource) {
                var QueryEditor = _this.getReactQueryEditor(datasource);
                if (QueryEditor) {
                    return (React.createElement(QueryEditor, { key: datasource === null || datasource === void 0 ? void 0 : datasource.name, query: query, datasource: datasource, onChange: onChange, onRunQuery: onRunQuery, data: data, range: getTimeSrv().timeRange(), queries: queries, app: app, history: history }));
                }
            }
            return React.createElement("div", null, "Data source plugin does not export any Query Editor component");
        };
        _this.onToggleEditMode = function (e, props) {
            var _a;
            e.stopPropagation();
            if (_this.angularScope && _this.angularScope.toggleEditorMode) {
                _this.angularScope.toggleEditorMode();
                (_a = _this.angularQueryEditor) === null || _a === void 0 ? void 0 : _a.digest();
                if (!props.isOpen) {
                    props.onOpen();
                }
            }
        };
        _this.onRemoveQuery = function () {
            _this.props.onRemoveQuery(_this.props.query);
        };
        _this.onCopyQuery = function () {
            var copy = cloneDeep(_this.props.query);
            _this.props.onAddQuery(copy);
        };
        _this.onDisableQuery = function () {
            var query = _this.props.query;
            _this.props.onChange(__assign(__assign({}, query), { hide: !query.hide }));
            _this.props.onRunQuery();
        };
        _this.onToggleHelp = function () {
            _this.setState(function (state) { return ({
                showingHelp: !state.showingHelp,
            }); });
        };
        _this.onClickExample = function (query) {
            _this.props.onChange(__assign(__assign({}, query), { refId: _this.props.query.refId }));
            _this.onToggleHelp();
        };
        _this.renderExtraActions = function () {
            var _a = _this.props, query = _a.query, queries = _a.queries, data = _a.data, onAddQuery = _a.onAddQuery, dataSource = _a.dataSource;
            return RowActionComponents.getAllExtraRenderAction().map(function (c, index) {
                return React.createElement(c, {
                    query: query,
                    queries: queries,
                    timeRange: data.timeRange,
                    onAddQuery: onAddQuery,
                    dataSource: dataSource,
                    key: index,
                });
            });
        };
        _this.renderActions = function (props) {
            var _a;
            var _b = _this.props, query = _b.query, _c = _b.hideDisableQuery, hideDisableQuery = _c === void 0 ? false : _c;
            var _d = _this.state, hasTextEditMode = _d.hasTextEditMode, datasource = _d.datasource, showingHelp = _d.showingHelp;
            var isDisabled = query.hide;
            var hasEditorHelp = (_a = datasource === null || datasource === void 0 ? void 0 : datasource.components) === null || _a === void 0 ? void 0 : _a.QueryEditorHelp;
            return (React.createElement(HorizontalGroup, { width: "auto" },
                hasEditorHelp && (React.createElement(QueryOperationAction, { title: "Toggle data source help", icon: "question-circle", onClick: _this.onToggleHelp, active: showingHelp })),
                hasTextEditMode && (React.createElement(QueryOperationAction, { title: "Toggle text edit mode", icon: "pen", onClick: function (e) {
                        _this.onToggleEditMode(e, props);
                    } })),
                _this.renderExtraActions(),
                React.createElement(QueryOperationAction, { title: "Duplicate query", icon: "copy", onClick: _this.onCopyQuery }),
                !hideDisableQuery ? (React.createElement(QueryOperationAction, { title: "Disable/enable query", icon: isDisabled ? 'eye-slash' : 'eye', active: isDisabled, onClick: _this.onDisableQuery })) : null,
                React.createElement(QueryOperationAction, { title: "Remove query", icon: "trash-alt", onClick: _this.onRemoveQuery })));
        };
        _this.renderHeader = function (props) {
            var _a = _this.props, query = _a.query, dataSource = _a.dataSource, onChangeDataSource = _a.onChangeDataSource, onChange = _a.onChange, queries = _a.queries, renderHeaderExtras = _a.renderHeaderExtras;
            return (React.createElement(QueryEditorRowHeader, { query: query, queries: queries, onChangeDataSource: onChangeDataSource, dataSource: dataSource, disabled: query.hide, onClick: function (e) { return _this.onToggleEditMode(e, props); }, onChange: onChange, collapsedText: !props.isOpen ? _this.renderCollapsedText() : null, renderExtras: renderHeaderExtras }));
        };
        return _this;
    }
    QueryEditorRow.prototype.componentDidMount = function () {
        this.loadDatasource();
    };
    QueryEditorRow.prototype.componentWillUnmount = function () {
        if (this.angularQueryEditor) {
            this.angularQueryEditor.destroy();
        }
    };
    QueryEditorRow.prototype.getAngularQueryComponentScope = function () {
        var _this = this;
        var _a = this.props, query = _a.query, queries = _a.queries;
        var datasource = this.state.datasource;
        var panel = new PanelModel({ targets: queries });
        var dashboard = {};
        var me = this;
        return {
            datasource: datasource,
            target: query,
            panel: panel,
            dashboard: dashboard,
            refresh: function () {
                // Old angular editors modify the query model and just call refresh
                // Important that this use this.props here so that as this function is only created on mount and it's
                // important not to capture old prop functions in this closure
                // the "hide" attribute of the queries can be changed from the "outside",
                // it will be applied to "this.props.query.hide", but not to "query.hide".
                // so we have to apply it.
                if (query.hide !== me.props.query.hide) {
                    query.hide = me.props.query.hide;
                }
                _this.props.onChange(query);
                _this.props.onRunQuery();
            },
            render: function () { return function () { return console.log('legacy render function called, it does nothing'); }; },
            events: this.props.eventBus || new EventBusSrv(),
            range: getTimeSrv().timeRange(),
        };
    };
    QueryEditorRow.prototype.getQueryDataSourceIdentifier = function () {
        var _a, _b;
        var _c = this.props, query = _c.query, dsSettings = _c.dataSource;
        return (_b = (_a = query.datasource) === null || _a === void 0 ? void 0 : _a.uid) !== null && _b !== void 0 ? _b : dsSettings.uid;
    };
    QueryEditorRow.prototype.loadDatasource = function () {
        return __awaiter(this, void 0, void 0, function () {
            var dataSourceSrv, datasource, dataSourceIdentifier, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dataSourceSrv = getDatasourceSrv();
                        dataSourceIdentifier = this.getQueryDataSourceIdentifier();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 5]);
                        return [4 /*yield*/, dataSourceSrv.get(dataSourceIdentifier)];
                    case 2:
                        datasource = _a.sent();
                        return [3 /*break*/, 5];
                    case 3:
                        error_1 = _a.sent();
                        return [4 /*yield*/, dataSourceSrv.get()];
                    case 4:
                        datasource = _a.sent();
                        return [3 /*break*/, 5];
                    case 5:
                        this.setState({
                            datasource: datasource,
                            loadedDataSourceIdentifier: dataSourceIdentifier,
                            hasTextEditMode: has(datasource, 'components.QueryCtrl.prototype.toggleEditorMode'),
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    QueryEditorRow.prototype.componentDidUpdate = function (prevProps) {
        var _a = this.state, datasource = _a.datasource, loadedDataSourceIdentifier = _a.loadedDataSourceIdentifier;
        var _b = this.props, data = _b.data, query = _b.query;
        if (data !== prevProps.data) {
            var dataFilteredByRefId = filterPanelDataToQuery(data, query.refId);
            this.setState({ data: dataFilteredByRefId });
            if (this.angularScope) {
                this.angularScope.range = getTimeSrv().timeRange();
            }
            if (this.angularQueryEditor && dataFilteredByRefId) {
                notifyAngularQueryEditorsOfData(this.angularScope, dataFilteredByRefId, this.angularQueryEditor);
            }
        }
        // check if we need to load another datasource
        if (datasource && loadedDataSourceIdentifier !== this.getQueryDataSourceIdentifier()) {
            if (this.angularQueryEditor) {
                this.angularQueryEditor.destroy();
                this.angularQueryEditor = null;
            }
            this.loadDatasource();
            return;
        }
        if (!this.element || this.angularQueryEditor) {
            return;
        }
        this.renderAngularQueryEditor();
    };
    QueryEditorRow.prototype.getReactQueryEditor = function (ds) {
        var _a, _b, _c, _d, _e;
        if (!ds) {
            return;
        }
        switch (this.props.app) {
            case CoreApp.Explore:
                return (((_a = ds.components) === null || _a === void 0 ? void 0 : _a.ExploreMetricsQueryField) ||
                    ((_b = ds.components) === null || _b === void 0 ? void 0 : _b.ExploreLogsQueryField) ||
                    ((_c = ds.components) === null || _c === void 0 ? void 0 : _c.ExploreQueryField) ||
                    ((_d = ds.components) === null || _d === void 0 ? void 0 : _d.QueryEditor));
            case CoreApp.PanelEditor:
            case CoreApp.Dashboard:
            default:
                return (_e = ds.components) === null || _e === void 0 ? void 0 : _e.QueryEditor;
        }
    };
    QueryEditorRow.prototype.renderCollapsedText = function () {
        var datasource = this.state.datasource;
        if (datasource === null || datasource === void 0 ? void 0 : datasource.getQueryDisplayText) {
            return datasource.getQueryDisplayText(this.props.query);
        }
        if (this.angularScope && this.angularScope.getCollapsedText) {
            return this.angularScope.getCollapsedText();
        }
        return null;
    };
    QueryEditorRow.prototype.render = function () {
        var _this = this;
        var _a;
        var _b = this.props, query = _b.query, id = _b.id, index = _b.index, visualization = _b.visualization;
        var _c = this.state, datasource = _c.datasource, showingHelp = _c.showingHelp;
        var isDisabled = query.hide;
        var rowClasses = classNames('query-editor-row', {
            'query-editor-row--disabled': isDisabled,
            'gf-form-disabled': isDisabled,
        });
        if (!datasource) {
            return null;
        }
        var editor = this.renderPluginEditor();
        var DatasourceCheatsheet = (_a = datasource.components) === null || _a === void 0 ? void 0 : _a.QueryEditorHelp;
        return (React.createElement("div", { "aria-label": selectors.components.QueryEditorRows.rows },
            React.createElement(QueryOperationRow, { id: id, draggable: true, index: index, headerElement: this.renderHeader, actions: this.renderActions, onOpen: this.onOpen },
                React.createElement("div", { className: rowClasses },
                    React.createElement(ErrorBoundaryAlert, null,
                        showingHelp && DatasourceCheatsheet && (React.createElement(OperationRowHelp, null,
                            React.createElement(DatasourceCheatsheet, { onClickExample: function (query) { return _this.onClickExample(query); }, datasource: datasource }))),
                        editor),
                    visualization))));
    };
    return QueryEditorRow;
}(PureComponent));
export { QueryEditorRow };
function notifyAngularQueryEditorsOfData(scope, data, editor) {
    if (data.state === LoadingState.Done) {
        var legacy = data.series.map(function (v) { return toLegacyResponseData(v); });
        scope.events.emit(PanelEvents.dataReceived, legacy);
    }
    else if (data.state === LoadingState.Error) {
        scope.events.emit(PanelEvents.dataError, data.error);
    }
    // Some query controllers listen to data error events and need a digest
    // for some reason this needs to be done in next tick
    setTimeout(editor.digest);
}
/**
 * Get a version of the PanelData limited to the query we are looking at
 */
export function filterPanelDataToQuery(data, refId) {
    var series = data.series.filter(function (series) { return series.refId === refId; });
    // No matching series
    if (!series.length) {
        // If there was an error with no data, pass it to the QueryEditors
        if (data.error && !data.series.length) {
            return __assign(__assign({}, data), { state: LoadingState.Error });
        }
        return undefined;
    }
    // Only say this is an error if the error links to the query
    var state = LoadingState.Done;
    var error = data.error && data.error.refId === refId ? data.error : undefined;
    if (error) {
        state = LoadingState.Error;
    }
    var timeRange = data.timeRange;
    return __assign(__assign({}, data), { state: state, series: series, error: error, timeRange: timeRange });
}
//# sourceMappingURL=QueryEditorRow.js.map