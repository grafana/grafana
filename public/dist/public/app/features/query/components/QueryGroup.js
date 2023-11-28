import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { CoreApp, getDefaultTimeRange, LoadingState, PluginType, } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getDataSourceSrv, locationService } from '@grafana/runtime';
import { Button, CustomScrollbar, HorizontalGroup, InlineFormLabel, Modal, stylesFactory } from '@grafana/ui';
import { PluginHelp } from 'app/core/components/PluginHelp/PluginHelp';
import config from 'app/core/config';
import { backendSrv } from 'app/core/services/backend_srv';
import { addQuery, queryIsEmpty } from 'app/core/utils/query';
import { DataSourceModal } from 'app/features/datasources/components/picker/DataSourceModal';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { dataSource as expressionDatasource } from 'app/features/expressions/ExpressionDatasource';
import { AngularDeprecationPluginNotice } from 'app/features/plugins/angularDeprecation/AngularDeprecationPluginNotice';
import { DashboardQueryEditor, isSharedDashboardQuery } from 'app/plugins/datasource/dashboard';
import { isAngularDatasourcePlugin } from '../../plugins/angularDeprecation/utils';
import { updateQueries } from '../state/updateQueries';
import { GroupActionComponents } from './QueryActionComponent';
import { QueryEditorRows } from './QueryEditorRows';
import { QueryGroupOptionsEditor } from './QueryGroupOptions';
export class QueryGroup extends PureComponent {
    constructor() {
        super(...arguments);
        this.backendSrv = backendSrv;
        this.dataSourceSrv = getDataSourceSrv();
        this.querySubscription = null;
        this.state = {
            isDataSourceModalOpen: !!locationService.getSearchObject().firstPanel,
            isLoadingHelp: false,
            helpContent: null,
            isPickerOpen: false,
            isHelpOpen: false,
            queries: [],
            data: {
                state: LoadingState.NotStarted,
                series: [],
                timeRange: getDefaultTimeRange(),
            },
        };
        this.onChangeDataSource = (newSettings, defaultQueries) => __awaiter(this, void 0, void 0, function* () {
            const { dsSettings } = this.state;
            const currentDS = dsSettings ? yield getDataSourceSrv().get(dsSettings.uid) : undefined;
            const nextDS = yield getDataSourceSrv().get(newSettings.uid);
            // We need to pass in newSettings.uid as well here as that can be a variable expression and we want to store that in the query model not the current ds variable value
            const queries = defaultQueries || (yield updateQueries(nextDS, newSettings.uid, this.state.queries, currentDS));
            const dataSource = yield this.dataSourceSrv.get(newSettings.name);
            this.onChange({
                queries,
                dataSource: {
                    name: newSettings.name,
                    uid: newSettings.uid,
                    type: newSettings.meta.id,
                    default: newSettings.isDefault,
                },
            });
            this.setState({
                queries,
                dataSource: dataSource,
                dsSettings: newSettings,
            });
            if (defaultQueries) {
                this.props.onRunQueries();
            }
        });
        this.onAddQueryClick = () => {
            const { queries } = this.state;
            this.onQueriesChange(addQuery(queries, this.newQuery()));
            this.onScrollBottom();
        };
        this.onAddExpressionClick = () => {
            this.onQueriesChange(addQuery(this.state.queries, expressionDatasource.newQuery()));
            this.onScrollBottom();
        };
        this.onScrollBottom = () => {
            setTimeout(() => {
                if (this.state.scrollElement) {
                    this.state.scrollElement.scrollTo({ top: 10000 });
                }
            }, 20);
        };
        this.onUpdateAndRun = (options) => {
            this.props.onOptionsChange(options);
            this.props.onRunQueries();
        };
        this.onOpenHelp = () => {
            this.setState({ isHelpOpen: true });
        };
        this.onCloseHelp = () => {
            this.setState({ isHelpOpen: false });
        };
        this.onCloseDataSourceModal = () => {
            this.setState({ isDataSourceModalOpen: false });
        };
        this.renderDataSourcePickerWithPrompt = () => {
            const { isDataSourceModalOpen } = this.state;
            const commonProps = {
                metrics: true,
                mixed: true,
                dashboard: true,
                variables: true,
                current: this.props.options.dataSource,
                uploadFile: true,
                onChange: (ds, defaultQueries) => __awaiter(this, void 0, void 0, function* () {
                    yield this.onChangeDataSource(ds, defaultQueries);
                    this.onCloseDataSourceModal();
                }),
            };
            return (React.createElement(React.Fragment, null,
                isDataSourceModalOpen && config.featureToggles.advancedDataSourcePicker && (React.createElement(DataSourceModal, Object.assign({}, commonProps, { onDismiss: this.onCloseDataSourceModal }))),
                React.createElement(DataSourcePicker, Object.assign({}, commonProps))));
        };
        this.onAddQuery = (query) => {
            const { dsSettings, queries } = this.state;
            this.onQueriesChange(addQuery(queries, query, { type: dsSettings === null || dsSettings === void 0 ? void 0 : dsSettings.type, uid: dsSettings === null || dsSettings === void 0 ? void 0 : dsSettings.uid }));
            this.onScrollBottom();
        };
        this.onQueriesChange = (queries) => {
            this.onChange({ queries });
            this.setState({ queries });
        };
        this.setScrollRef = (scrollElement) => {
            this.setState({ scrollElement });
        };
    }
    componentDidMount() {
        return __awaiter(this, void 0, void 0, function* () {
            const { options, queryRunner } = this.props;
            this.querySubscription = queryRunner.getData({ withTransforms: false, withFieldConfig: false }).subscribe({
                next: (data) => this.onPanelDataUpdate(data),
            });
            this.setNewQueriesAndDatasource(options);
            // Clean up the first panel flag since the modal is now open
            if (!!locationService.getSearchObject().firstPanel) {
                locationService.partial({ firstPanel: null }, true);
            }
        });
    }
    componentWillUnmount() {
        if (this.querySubscription) {
            this.querySubscription.unsubscribe();
            this.querySubscription = null;
        }
    }
    componentDidUpdate() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const { options } = this.props;
            const currentDS = yield getDataSourceSrv().get(options.dataSource);
            if (this.state.dataSource && currentDS.uid !== ((_a = this.state.dataSource) === null || _a === void 0 ? void 0 : _a.uid)) {
                this.setNewQueriesAndDatasource(options);
            }
        });
    }
    setNewQueriesAndDatasource(options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const ds = yield this.dataSourceSrv.get(options.dataSource);
                const dsSettings = this.dataSourceSrv.getInstanceSettings(options.dataSource);
                const defaultDataSource = yield this.dataSourceSrv.get();
                const datasource = ds.getRef();
                const queries = options.queries.map((q) => {
                    var _a;
                    return (Object.assign(Object.assign(Object.assign({}, (queryIsEmpty(q) && ((_a = ds === null || ds === void 0 ? void 0 : ds.getDefaultQuery) === null || _a === void 0 ? void 0 : _a.call(ds, CoreApp.PanelEditor)))), { datasource }), q));
                });
                this.setState({
                    queries,
                    dataSource: ds,
                    dsSettings,
                    defaultDataSource,
                });
            }
            catch (error) {
                console.log('failed to load data source', error);
            }
        });
    }
    onPanelDataUpdate(data) {
        this.setState({ data });
    }
    newQuery() {
        var _a, _b;
        const { dsSettings, defaultDataSource } = this.state;
        const ds = !(dsSettings === null || dsSettings === void 0 ? void 0 : dsSettings.meta.mixed) ? dsSettings : defaultDataSource;
        return Object.assign(Object.assign({}, (_b = (_a = this.state.dataSource) === null || _a === void 0 ? void 0 : _a.getDefaultQuery) === null || _b === void 0 ? void 0 : _b.call(_a, CoreApp.PanelEditor)), { datasource: { uid: ds === null || ds === void 0 ? void 0 : ds.uid, type: ds === null || ds === void 0 ? void 0 : ds.type } });
    }
    onChange(changedProps) {
        this.props.onOptionsChange(Object.assign(Object.assign({}, this.props.options), changedProps));
    }
    renderTopSection(styles) {
        const { onOpenQueryInspector, options } = this.props;
        const { dataSource, data } = this.state;
        return (React.createElement("div", null,
            React.createElement("div", { className: styles.dataSourceRow },
                React.createElement(InlineFormLabel, { htmlFor: "data-source-picker", width: 'auto' }, "Data source"),
                React.createElement("div", { className: styles.dataSourceRowItem }, this.renderDataSourcePickerWithPrompt()),
                dataSource && (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: styles.dataSourceRowItem },
                        React.createElement(Button, { variant: "secondary", icon: "question-circle", title: "Open data source help", onClick: this.onOpenHelp, "data-testid": "query-tab-help-button" })),
                    React.createElement("div", { className: styles.dataSourceRowItemOptions },
                        React.createElement(QueryGroupOptionsEditor, { options: options, dataSource: dataSource, data: data, onChange: this.onUpdateAndRun })),
                    onOpenQueryInspector && (React.createElement("div", { className: styles.dataSourceRowItem },
                        React.createElement(Button, { variant: "secondary", onClick: onOpenQueryInspector, "aria-label": selectors.components.QueryTab.queryInspectorButton }, "Query inspector")))))),
            dataSource && isAngularDatasourcePlugin(dataSource.uid) && (React.createElement(AngularDeprecationPluginNotice, { pluginId: dataSource.type, pluginType: PluginType.datasource, angularSupportEnabled: config === null || config === void 0 ? void 0 : config.angularSupportEnabled, showPluginDetailsLink: true, interactionElementId: "datasource-query" }))));
    }
    renderQueries(dsSettings) {
        const { onRunQueries } = this.props;
        const { data, queries } = this.state;
        if (isSharedDashboardQuery(dsSettings.name)) {
            return (React.createElement(DashboardQueryEditor, { queries: queries, panelData: data, onChange: this.onQueriesChange, onRunQueries: onRunQueries }));
        }
        return (React.createElement("div", { "aria-label": selectors.components.QueryTab.content },
            React.createElement(QueryEditorRows, { queries: queries, dsSettings: dsSettings, onQueriesChange: this.onQueriesChange, onAddQuery: this.onAddQuery, onRunQueries: onRunQueries, data: data })));
    }
    isExpressionsSupported(dsSettings) {
        return (dsSettings.meta.alerting || dsSettings.meta.mixed) === true;
    }
    renderExtraActions() {
        return GroupActionComponents.getAllExtraRenderAction()
            .map((action, index) => action({
            onAddQuery: this.onAddQuery,
            onChangeDataSource: this.onChangeDataSource,
            key: index,
        }))
            .filter(Boolean);
    }
    renderAddQueryRow(dsSettings, styles) {
        const showAddButton = !isSharedDashboardQuery(dsSettings.name);
        return (React.createElement(HorizontalGroup, { spacing: "md", align: "flex-start" },
            showAddButton && (React.createElement(Button, { icon: "plus", onClick: this.onAddQueryClick, variant: "secondary", "data-testid": selectors.components.QueryTab.addQuery }, "Add query")),
            config.expressionsEnabled && this.isExpressionsSupported(dsSettings) && (React.createElement(Button, { icon: "plus", onClick: this.onAddExpressionClick, variant: "secondary", className: styles.expressionButton, "data-testid": "query-tab-add-expression" },
                React.createElement("span", null, "Expression\u00A0"))),
            this.renderExtraActions()));
    }
    render() {
        const { isHelpOpen, dsSettings } = this.state;
        const styles = getStyles();
        return (React.createElement(CustomScrollbar, { autoHeightMin: "100%", scrollRefCallback: this.setScrollRef },
            React.createElement("div", { className: styles.innerWrapper },
                this.renderTopSection(styles),
                dsSettings && (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: styles.queriesWrapper }, this.renderQueries(dsSettings)),
                    this.renderAddQueryRow(dsSettings, styles),
                    isHelpOpen && (React.createElement(Modal, { title: "Data source help", isOpen: true, onDismiss: this.onCloseHelp },
                        React.createElement(PluginHelp, { pluginId: dsSettings.meta.id }))))))));
    }
}
const getStyles = stylesFactory(() => {
    const { theme } = config;
    return {
        innerWrapper: css `
      display: flex;
      flex-direction: column;
      padding: ${theme.spacing.md};
    `,
        dataSourceRow: css `
      display: flex;
      margin-bottom: ${theme.spacing.md};
    `,
        dataSourceRowItem: css `
      margin-right: ${theme.spacing.inlineFormMargin};
    `,
        dataSourceRowItemOptions: css `
      flex-grow: 1;
      margin-right: ${theme.spacing.inlineFormMargin};
    `,
        queriesWrapper: css `
      padding-bottom: 16px;
    `,
        expressionWrapper: css ``,
        expressionButton: css `
      margin-right: ${theme.spacing.sm};
    `,
    };
});
//# sourceMappingURL=QueryGroup.js.map