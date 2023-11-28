import { __awaiter } from "tslib";
// Libraries
import classNames from 'classnames';
import { cloneDeep, filter, has, uniqBy, uniqueId } from 'lodash';
import pluralize from 'pluralize';
import React, { PureComponent } from 'react';
// Utils & Services
import { CoreApp, DataSourcePluginContextProvider, EventBusSrv, LoadingState, PanelEvents, toLegacyResponseData, } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getAngularLoader, getDataSourceSrv } from '@grafana/runtime';
import { Badge, ErrorBoundaryAlert } from '@grafana/ui';
import { OperationRowHelp } from 'app/core/components/QueryOperationRow/OperationRowHelp';
import { QueryOperationAction, QueryOperationToggleAction, } from 'app/core/components/QueryOperationRow/QueryOperationAction';
import { QueryOperationRow, } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { RowActionComponents } from './QueryActionComponent';
import { QueryEditorRowHeader } from './QueryEditorRowHeader';
import { QueryErrorAlert } from './QueryErrorAlert';
export class QueryEditorRow extends PureComponent {
    constructor() {
        super(...arguments);
        this.element = null;
        this.angularScope = null;
        this.angularQueryEditor = null;
        this.dataSourceSrv = getDataSourceSrv();
        this.id = '';
        this.state = {
            datasource: null,
            hasTextEditMode: false,
            data: undefined,
            isOpen: true,
            showingHelp: false,
        };
        this.renderAngularQueryEditor = () => {
            if (!this.element) {
                return;
            }
            if (this.angularQueryEditor) {
                this.angularQueryEditor.destroy();
                this.angularQueryEditor = null;
            }
            const loader = getAngularLoader();
            const template = '<plugin-component type="query-ctrl" />';
            const scopeProps = { ctrl: this.getAngularQueryComponentScope() };
            this.angularQueryEditor = loader.load(this.element, scopeProps, template);
            this.angularScope = scopeProps.ctrl;
        };
        this.onOpen = () => {
            this.renderAngularQueryEditor();
        };
        this.renderPluginEditor = () => {
            var _a;
            const { query, onChange, queries, onRunQuery, onAddQuery, app = CoreApp.PanelEditor, history } = this.props;
            const { datasource, data } = this.state;
            if (this.isWaitingForDatasourceToLoad()) {
                return null;
            }
            if ((_a = datasource === null || datasource === void 0 ? void 0 : datasource.components) === null || _a === void 0 ? void 0 : _a.QueryCtrl) {
                return React.createElement("div", { ref: (element) => (this.element = element) });
            }
            if (datasource) {
                let QueryEditor = this.getReactQueryEditor(datasource);
                if (QueryEditor) {
                    return (React.createElement(DataSourcePluginContextProvider, { instanceSettings: this.props.dataSource },
                        React.createElement(QueryEditor, { key: datasource === null || datasource === void 0 ? void 0 : datasource.name, query: query, datasource: datasource, onChange: onChange, onRunQuery: onRunQuery, onAddQuery: onAddQuery, data: data, range: getTimeSrv().timeRange(), queries: queries, app: app, history: history })));
                }
            }
            return React.createElement("div", null, "Data source plugin does not export any Query Editor component");
        };
        this.onToggleEditMode = (e, props) => {
            var _a;
            e.stopPropagation();
            if (this.angularScope && this.angularScope.toggleEditorMode) {
                this.angularScope.toggleEditorMode();
                (_a = this.angularQueryEditor) === null || _a === void 0 ? void 0 : _a.digest();
                if (!props.isOpen) {
                    props.onOpen();
                }
            }
        };
        this.onRemoveQuery = () => {
            const { onRemoveQuery, query, onQueryRemoved } = this.props;
            onRemoveQuery(query);
            if (onQueryRemoved) {
                onQueryRemoved();
            }
        };
        this.onCopyQuery = () => {
            const { query, onAddQuery, onQueryCopied } = this.props;
            const copy = cloneDeep(query);
            onAddQuery(copy);
            if (onQueryCopied) {
                onQueryCopied();
            }
        };
        this.onDisableQuery = () => {
            const { query, onChange, onRunQuery, onQueryToggled } = this.props;
            onChange(Object.assign(Object.assign({}, query), { hide: !query.hide }));
            onRunQuery();
            if (onQueryToggled) {
                onQueryToggled(query.hide);
            }
        };
        this.onToggleHelp = () => {
            this.setState((state) => ({
                showingHelp: !state.showingHelp,
            }));
        };
        this.onClickExample = (query) => {
            if (query.datasource === undefined) {
                query.datasource = { type: this.props.dataSource.type, uid: this.props.dataSource.uid };
            }
            this.props.onChange(Object.assign(Object.assign({}, query), { refId: this.props.query.refId }));
            this.onToggleHelp();
        };
        this.renderWarnings = () => {
            var _a, _b;
            const { data, query } = this.props;
            const dataFilteredByRefId = (_b = (_a = filterPanelDataToQuery(data, query.refId)) === null || _a === void 0 ? void 0 : _a.series) !== null && _b !== void 0 ? _b : [];
            const allWarnings = dataFilteredByRefId.reduce((acc, serie) => {
                var _a, _b;
                if (!((_a = serie.meta) === null || _a === void 0 ? void 0 : _a.notices)) {
                    return acc;
                }
                const warnings = (_b = filter(serie.meta.notices, { severity: 'warning' })) !== null && _b !== void 0 ? _b : [];
                return acc.concat(warnings);
            }, []);
            const uniqueWarnings = uniqBy(allWarnings, 'text');
            const hasWarnings = uniqueWarnings.length > 0;
            if (!hasWarnings) {
                return null;
            }
            const serializedWarnings = uniqueWarnings.map((warning) => warning.text).join('\n');
            return (React.createElement(Badge, { color: "orange", icon: "exclamation-triangle", text: React.createElement(React.Fragment, null,
                    uniqueWarnings.length,
                    " ",
                    pluralize('warning', uniqueWarnings.length)), tooltip: serializedWarnings }));
        };
        this.renderExtraActions = () => {
            const { query, queries, data, onAddQuery, dataSource } = this.props;
            const extraActions = RowActionComponents.getAllExtraRenderAction()
                .map((action, index) => action({
                query,
                queries,
                timeRange: data.timeRange,
                onAddQuery: onAddQuery,
                dataSource,
                key: index,
            }))
                .filter(Boolean);
            extraActions.push(this.renderWarnings());
            return extraActions;
        };
        this.renderActions = (props) => {
            var _a;
            const { query, hideDisableQuery = false } = this.props;
            const { hasTextEditMode, datasource, showingHelp } = this.state;
            const isDisabled = !!query.hide;
            const hasEditorHelp = (_a = datasource === null || datasource === void 0 ? void 0 : datasource.components) === null || _a === void 0 ? void 0 : _a.QueryEditorHelp;
            return (React.createElement(React.Fragment, null,
                hasEditorHelp && (React.createElement(QueryOperationToggleAction, { title: "Show data source help", icon: "question-circle", onClick: this.onToggleHelp, active: showingHelp })),
                hasTextEditMode && (React.createElement(QueryOperationAction, { title: "Toggle text edit mode", icon: "pen", onClick: (e) => {
                        this.onToggleEditMode(e, props);
                    } })),
                this.renderExtraActions(),
                React.createElement(QueryOperationAction, { title: "Duplicate query", icon: "copy", onClick: this.onCopyQuery }),
                !hideDisableQuery ? (React.createElement(QueryOperationToggleAction, { title: "Disable query", icon: isDisabled ? 'eye-slash' : 'eye', active: isDisabled, onClick: this.onDisableQuery })) : null,
                React.createElement(QueryOperationAction, { title: "Remove query", icon: "trash-alt", onClick: this.onRemoveQuery })));
        };
        this.renderHeader = (props) => {
            const { alerting, query, dataSource, onChangeDataSource, onChange, queries, renderHeaderExtras } = this.props;
            return (React.createElement(QueryEditorRowHeader, { query: query, queries: queries, onChangeDataSource: onChangeDataSource, dataSource: dataSource, disabled: query.hide, onClick: (e) => this.onToggleEditMode(e, props), onChange: onChange, collapsedText: !props.isOpen ? this.renderCollapsedText() : null, renderExtras: renderHeaderExtras, alerting: alerting }));
        };
    }
    componentDidMount() {
        const { data, query, id } = this.props;
        const dataFilteredByRefId = filterPanelDataToQuery(data, query.refId);
        this.id = uniqueId(id + '_');
        this.setState({ data: dataFilteredByRefId });
        this.loadDatasource();
    }
    componentWillUnmount() {
        if (this.angularQueryEditor) {
            this.angularQueryEditor.destroy();
        }
    }
    getAngularQueryComponentScope() {
        const { query, queries } = this.props;
        const { datasource } = this.state;
        const panel = new PanelModel({ targets: queries });
        const dashboard = {};
        const me = this;
        return {
            datasource: datasource,
            target: query,
            panel: panel,
            dashboard: dashboard,
            refresh: () => {
                // Old angular editors modify the query model and just call refresh
                // Important that this use this.props here so that as this function is only created on mount and it's
                // important not to capture old prop functions in this closure
                // the "hide" attribute of the queries can be changed from the "outside",
                // it will be applied to "this.props.query.hide", but not to "query.hide".
                // so we have to apply it.
                if (query.hide !== me.props.query.hide) {
                    query.hide = me.props.query.hide;
                }
                this.props.onChange(query);
                this.props.onRunQuery();
            },
            render: () => () => console.log('legacy render function called, it does nothing'),
            events: this.props.eventBus || new EventBusSrv(),
            range: getTimeSrv().timeRange(),
        };
    }
    /**
     * When datasource variables are used the query.datasource.uid property is a string variable expression
     * DataSourceSettings.uid can also be this variable expression.
     * This function always returns the current interpolated datasource uid.
     */
    getInterpolatedDataSourceUID() {
        var _a, _b, _c, _d;
        if (this.props.query.datasource) {
            const instanceSettings = this.dataSourceSrv.getInstanceSettings(this.props.query.datasource);
            return (_b = (_a = instanceSettings === null || instanceSettings === void 0 ? void 0 : instanceSettings.rawRef) === null || _a === void 0 ? void 0 : _a.uid) !== null && _b !== void 0 ? _b : instanceSettings === null || instanceSettings === void 0 ? void 0 : instanceSettings.uid;
        }
        return (_d = (_c = this.props.dataSource.rawRef) === null || _c === void 0 ? void 0 : _c.uid) !== null && _d !== void 0 ? _d : this.props.dataSource.uid;
    }
    loadDatasource() {
        return __awaiter(this, void 0, void 0, function* () {
            let datasource;
            const interpolatedUID = this.getInterpolatedDataSourceUID();
            try {
                datasource = yield this.dataSourceSrv.get(interpolatedUID);
            }
            catch (error) {
                // If the DS doesn't exist, it fails. Getting with no args returns the default DS.
                datasource = yield this.dataSourceSrv.get();
            }
            if (typeof this.props.onDataSourceLoaded === 'function') {
                this.props.onDataSourceLoaded(datasource);
            }
            this.setState({
                datasource: datasource,
                queriedDataSourceIdentifier: interpolatedUID,
                hasTextEditMode: has(datasource, 'components.QueryCtrl.prototype.toggleEditorMode'),
            });
        });
    }
    componentDidUpdate(prevProps) {
        const { datasource, queriedDataSourceIdentifier } = this.state;
        const { data, query } = this.props;
        if (prevProps.id !== this.props.id) {
            this.id = uniqueId(this.props.id + '_');
        }
        if (data !== prevProps.data) {
            const dataFilteredByRefId = filterPanelDataToQuery(data, query.refId);
            this.setState({ data: dataFilteredByRefId });
            if (this.angularScope) {
                this.angularScope.range = getTimeSrv().timeRange();
            }
            if (this.angularQueryEditor && dataFilteredByRefId) {
                notifyAngularQueryEditorsOfData(this.angularScope, dataFilteredByRefId, this.angularQueryEditor);
            }
        }
        // check if we need to load another datasource
        if (datasource && queriedDataSourceIdentifier !== this.getInterpolatedDataSourceUID()) {
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
    }
    getReactQueryEditor(ds) {
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
    }
    isWaitingForDatasourceToLoad() {
        // if we not yet have loaded the datasource in state the
        // ds in props and the ds in state will have different values.
        return this.getInterpolatedDataSourceUID() !== this.state.queriedDataSourceIdentifier;
    }
    renderCollapsedText() {
        const { datasource } = this.state;
        if (datasource === null || datasource === void 0 ? void 0 : datasource.getQueryDisplayText) {
            return datasource.getQueryDisplayText(this.props.query);
        }
        if (this.angularScope && this.angularScope.getCollapsedText) {
            return this.angularScope.getCollapsedText();
        }
        return null;
    }
    render() {
        var _a;
        const { query, index, visualization, collapsable } = this.props;
        const { datasource, showingHelp, data } = this.state;
        const isDisabled = query.hide;
        const rowClasses = classNames('query-editor-row', {
            'query-editor-row--disabled': isDisabled,
            'gf-form-disabled': isDisabled,
        });
        if (!datasource) {
            return null;
        }
        const editor = this.renderPluginEditor();
        const DatasourceCheatsheet = (_a = datasource.components) === null || _a === void 0 ? void 0 : _a.QueryEditorHelp;
        return (React.createElement("div", { "data-testid": "query-editor-row", "aria-label": selectors.components.QueryEditorRows.rows },
            React.createElement(QueryOperationRow, { id: this.id, draggable: true, collapsable: collapsable, index: index, headerElement: this.renderHeader, actions: this.renderActions, onOpen: this.onOpen },
                React.createElement("div", { className: rowClasses, id: this.id },
                    React.createElement(ErrorBoundaryAlert, null,
                        showingHelp && DatasourceCheatsheet && (React.createElement(OperationRowHelp, null,
                            React.createElement(DatasourceCheatsheet, { onClickExample: (query) => this.onClickExample(query), query: this.props.query, datasource: datasource }))),
                        editor),
                    (data === null || data === void 0 ? void 0 : data.error) && data.error.refId === query.refId && React.createElement(QueryErrorAlert, { error: data.error }),
                    visualization))));
    }
}
function notifyAngularQueryEditorsOfData(scope, data, editor) {
    if (data.state === LoadingState.Done) {
        const legacy = data.series.map((v) => toLegacyResponseData(v));
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
    var _a, _b;
    const series = data.series.filter((series) => series.refId === refId);
    // If there was an error with no data and the panel is not in a loading state, pass it to the QueryEditors
    if (data.state !== LoadingState.Loading && (data.error || ((_a = data.errors) === null || _a === void 0 ? void 0 : _a.length)) && !data.series.length) {
        return Object.assign(Object.assign({}, data), { state: LoadingState.Error });
    }
    // Only say this is an error if the error links to the query
    let state = data.state;
    let error = (_b = data.errors) === null || _b === void 0 ? void 0 : _b.find((e) => e.refId === refId);
    if (!error && data.error) {
        error = data.error.refId === refId ? data.error : undefined;
    }
    if (state !== LoadingState.Loading) {
        if (error) {
            state = LoadingState.Error;
        }
        else if (data.state === LoadingState.Error) {
            state = LoadingState.Done;
        }
    }
    const timeRange = data.timeRange;
    return Object.assign(Object.assign({}, data), { state,
        series,
        error, errors: error ? [error] : undefined, timeRange });
}
//# sourceMappingURL=QueryEditorRow.js.map