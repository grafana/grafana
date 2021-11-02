import { __assign, __awaiter, __extends, __generator, __makeTemplateObject } from "tslib";
// Libraries
import React, { PureComponent } from 'react';
// Components
import { Button, CustomScrollbar, HorizontalGroup, Icon, InlineFormLabel, Modal, stylesFactory, Tooltip, } from '@grafana/ui';
import { DataSourcePicker, getDataSourceSrv } from '@grafana/runtime';
import { QueryEditorRows } from './QueryEditorRows';
// Services
import { backendSrv } from 'app/core/services/backend_srv';
import config from 'app/core/config';
// Types
import { getDefaultTimeRange, LoadingState, } from '@grafana/data';
import { PluginHelp } from 'app/core/components/PluginHelp/PluginHelp';
import { addQuery, updateQueries } from 'app/core/utils/query';
import { dataSource as expressionDatasource } from 'app/features/expressions/ExpressionDatasource';
import { selectors } from '@grafana/e2e-selectors';
import { QueryGroupOptionsEditor } from './QueryGroupOptions';
import { DashboardQueryEditor, isSharedDashboardQuery } from 'app/plugins/datasource/dashboard';
import { css } from '@emotion/css';
import { GroupActionComponents } from './QueryActionComponent';
var QueryGroup = /** @class */ (function (_super) {
    __extends(QueryGroup, _super);
    function QueryGroup() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.backendSrv = backendSrv;
        _this.dataSourceSrv = getDataSourceSrv();
        _this.querySubscription = null;
        _this.state = {
            isLoadingHelp: false,
            helpContent: null,
            isPickerOpen: false,
            isAddingMixed: false,
            isHelpOpen: false,
            scrollTop: 0,
            queries: [],
            data: {
                state: LoadingState.NotStarted,
                series: [],
                timeRange: getDefaultTimeRange(),
            },
        };
        _this.onChangeDataSource = function (newSettings) { return __awaiter(_this, void 0, void 0, function () {
            var dsSettings, queries, dataSource;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dsSettings = this.state.dsSettings;
                        queries = updateQueries(newSettings, this.state.queries, expressionDatasource.name, dsSettings);
                        return [4 /*yield*/, this.dataSourceSrv.get(newSettings.name)];
                    case 1:
                        dataSource = _a.sent();
                        this.onChange({
                            queries: queries,
                            dataSource: {
                                name: newSettings.name,
                                uid: newSettings.uid,
                                type: newSettings.meta.id,
                                default: newSettings.isDefault,
                            },
                        });
                        this.setState({
                            queries: queries,
                            dataSource: dataSource,
                            dsSettings: newSettings,
                        });
                        return [2 /*return*/];
                }
            });
        }); };
        _this.onAddQueryClick = function () {
            var queries = _this.state.queries;
            _this.onQueriesChange(addQuery(queries, _this.newQuery()));
            _this.onScrollBottom();
        };
        _this.onAddExpressionClick = function () {
            _this.onQueriesChange(addQuery(_this.state.queries, expressionDatasource.newQuery()));
            _this.onScrollBottom();
        };
        _this.onScrollBottom = function () {
            _this.setState({ scrollTop: 1000 });
        };
        _this.onUpdateAndRun = function (options) {
            _this.props.onOptionsChange(options);
            _this.props.onRunQueries();
        };
        _this.onOpenHelp = function () {
            _this.setState({ isHelpOpen: true });
        };
        _this.onCloseHelp = function () {
            _this.setState({ isHelpOpen: false });
        };
        _this.renderMixedPicker = function () {
            return (React.createElement(DataSourcePicker, { mixed: false, onChange: _this.onAddMixedQuery, current: null, autoFocus: true, variables: true, onBlur: _this.onMixedPickerBlur, openMenuOnFocus: true }));
        };
        _this.onAddMixedQuery = function (datasource) {
            _this.onAddQuery({ datasource: datasource.name });
            _this.setState({ isAddingMixed: false, scrollTop: _this.state.scrollTop + 10000 });
        };
        _this.onMixedPickerBlur = function () {
            _this.setState({ isAddingMixed: false });
        };
        _this.onAddQuery = function (query) {
            var _a = _this.state, dsSettings = _a.dsSettings, queries = _a.queries;
            _this.onQueriesChange(addQuery(queries, query, { type: dsSettings === null || dsSettings === void 0 ? void 0 : dsSettings.type, uid: dsSettings === null || dsSettings === void 0 ? void 0 : dsSettings.uid }));
            _this.onScrollBottom();
        };
        _this.setScrollTop = function (_a) {
            var scrollTop = _a.scrollTop;
            _this.setState({ scrollTop: scrollTop });
        };
        _this.onQueriesChange = function (queries) {
            _this.onChange({ queries: queries });
            _this.setState({ queries: queries });
        };
        return _this;
    }
    QueryGroup.prototype.componentDidMount = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, queryRunner, options, ds, dsSettings, defaultDataSource, datasource_1, queries, error_1;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this.props, queryRunner = _a.queryRunner, options = _a.options;
                        this.querySubscription = queryRunner.getData({ withTransforms: false, withFieldConfig: false }).subscribe({
                            next: function (data) { return _this.onPanelDataUpdate(data); },
                        });
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, this.dataSourceSrv.get(options.dataSource.name)];
                    case 2:
                        ds = _b.sent();
                        dsSettings = this.dataSourceSrv.getInstanceSettings(options.dataSource.name);
                        return [4 /*yield*/, this.dataSourceSrv.get()];
                    case 3:
                        defaultDataSource = _b.sent();
                        datasource_1 = { type: ds.type, uid: ds.uid };
                        queries = options.queries.map(function (q) { return (q.datasource ? q : __assign(__assign({}, q), { datasource: datasource_1 })); });
                        this.setState({ queries: queries, dataSource: ds, dsSettings: dsSettings, defaultDataSource: defaultDataSource });
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _b.sent();
                        console.log('failed to load data source', error_1);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    QueryGroup.prototype.componentWillUnmount = function () {
        if (this.querySubscription) {
            this.querySubscription.unsubscribe();
            this.querySubscription = null;
        }
    };
    QueryGroup.prototype.onPanelDataUpdate = function (data) {
        this.setState({ data: data });
    };
    QueryGroup.prototype.newQuery = function () {
        var _a = this.state, dsSettings = _a.dsSettings, defaultDataSource = _a.defaultDataSource;
        var ds = !(dsSettings === null || dsSettings === void 0 ? void 0 : dsSettings.meta.mixed) ? dsSettings : defaultDataSource;
        return {
            datasource: { uid: ds === null || ds === void 0 ? void 0 : ds.uid, type: ds === null || ds === void 0 ? void 0 : ds.type },
        };
    };
    QueryGroup.prototype.onChange = function (changedProps) {
        this.props.onOptionsChange(__assign(__assign({}, this.props.options), changedProps));
    };
    QueryGroup.prototype.renderTopSection = function (styles) {
        var _a = this.props, onOpenQueryInspector = _a.onOpenQueryInspector, options = _a.options;
        var _b = this.state, dataSource = _b.dataSource, data = _b.data;
        return (React.createElement("div", null,
            React.createElement("div", { className: styles.dataSourceRow },
                React.createElement(InlineFormLabel, { htmlFor: "data-source-picker", width: 'auto' }, "Data source"),
                React.createElement("div", { className: styles.dataSourceRowItem },
                    React.createElement(DataSourcePicker, { onChange: this.onChangeDataSource, current: options.dataSource, metrics: true, mixed: true, dashboard: true, variables: true })),
                dataSource && (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: styles.dataSourceRowItem },
                        React.createElement(Button, { variant: "secondary", icon: "question-circle", title: "Open data source help", onClick: this.onOpenHelp })),
                    React.createElement("div", { className: styles.dataSourceRowItemOptions },
                        React.createElement(QueryGroupOptionsEditor, { options: options, dataSource: dataSource, data: data, onChange: this.onUpdateAndRun })),
                    onOpenQueryInspector && (React.createElement("div", { className: styles.dataSourceRowItem },
                        React.createElement(Button, { variant: "secondary", onClick: onOpenQueryInspector, "aria-label": selectors.components.QueryTab.queryInspectorButton }, "Query inspector"))))))));
    };
    QueryGroup.prototype.renderQueries = function (dsSettings) {
        var onRunQueries = this.props.onRunQueries;
        var _a = this.state, data = _a.data, queries = _a.queries;
        if (isSharedDashboardQuery(dsSettings.name)) {
            return (React.createElement(DashboardQueryEditor, { queries: queries, panelData: data, onChange: this.onQueriesChange, onRunQueries: onRunQueries }));
        }
        return (React.createElement("div", { "aria-label": selectors.components.QueryTab.content },
            React.createElement(QueryEditorRows, { queries: queries, dsSettings: dsSettings, onQueriesChange: this.onQueriesChange, onAddQuery: this.onAddQuery, onRunQueries: onRunQueries, data: data })));
    };
    QueryGroup.prototype.isExpressionsSupported = function (dsSettings) {
        return (dsSettings.meta.alerting || dsSettings.meta.mixed) === true;
    };
    QueryGroup.prototype.renderExtraActions = function () {
        var _this = this;
        return GroupActionComponents.getAllExtraRenderAction().map(function (c, index) {
            return React.createElement(c, {
                onAddQuery: _this.onAddQuery,
                onChangeDataSource: _this.onChangeDataSource,
                key: index,
            });
        });
    };
    QueryGroup.prototype.renderAddQueryRow = function (dsSettings, styles) {
        var isAddingMixed = this.state.isAddingMixed;
        var showAddButton = !(isAddingMixed || isSharedDashboardQuery(dsSettings.name));
        return (React.createElement(HorizontalGroup, { spacing: "md", align: "flex-start" },
            showAddButton && (React.createElement(Button, { icon: "plus", onClick: this.onAddQueryClick, variant: "secondary", "aria-label": selectors.components.QueryTab.addQuery }, "Query")),
            config.expressionsEnabled && this.isExpressionsSupported(dsSettings) && (React.createElement(Tooltip, { content: "Beta feature: queries could stop working in next version", placement: "right" },
                React.createElement(Button, { icon: "plus", onClick: this.onAddExpressionClick, variant: "secondary", className: styles.expressionButton },
                    React.createElement("span", null, "Expression\u00A0"),
                    React.createElement(Icon, { name: "exclamation-triangle", className: "muted", size: "sm" })))),
            this.renderExtraActions()));
    };
    QueryGroup.prototype.render = function () {
        var _a = this.state, scrollTop = _a.scrollTop, isHelpOpen = _a.isHelpOpen, dsSettings = _a.dsSettings;
        var styles = getStyles();
        return (React.createElement(CustomScrollbar, { autoHeightMin: "100%", scrollTop: scrollTop, setScrollTop: this.setScrollTop },
            React.createElement("div", { className: styles.innerWrapper },
                this.renderTopSection(styles),
                dsSettings && (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: styles.queriesWrapper }, this.renderQueries(dsSettings)),
                    this.renderAddQueryRow(dsSettings, styles),
                    isHelpOpen && (React.createElement(Modal, { title: "Data source help", isOpen: true, onDismiss: this.onCloseHelp },
                        React.createElement(PluginHelp, { plugin: dsSettings.meta, type: "query_help" }))))))));
    };
    return QueryGroup;
}(PureComponent));
export { QueryGroup };
var getStyles = stylesFactory(function () {
    var theme = config.theme;
    return {
        innerWrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: column;\n      height: 100%;\n      padding: ", ";\n    "], ["\n      display: flex;\n      flex-direction: column;\n      height: 100%;\n      padding: ", ";\n    "])), theme.spacing.md),
        dataSourceRow: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: flex;\n      margin-bottom: ", ";\n    "], ["\n      display: flex;\n      margin-bottom: ", ";\n    "])), theme.spacing.md),
        dataSourceRowItem: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      margin-right: ", ";\n    "], ["\n      margin-right: ", ";\n    "])), theme.spacing.inlineFormMargin),
        dataSourceRowItemOptions: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      flex-grow: 1;\n      margin-right: ", ";\n    "], ["\n      flex-grow: 1;\n      margin-right: ", ";\n    "])), theme.spacing.inlineFormMargin),
        queriesWrapper: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      padding-bottom: 16px;\n    "], ["\n      padding-bottom: 16px;\n    "]))),
        expressionWrapper: css(templateObject_6 || (templateObject_6 = __makeTemplateObject([""], [""]))),
        expressionButton: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      margin-right: ", ";\n    "], ["\n      margin-right: ", ";\n    "])), theme.spacing.sm),
    };
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7;
//# sourceMappingURL=QueryGroup.js.map