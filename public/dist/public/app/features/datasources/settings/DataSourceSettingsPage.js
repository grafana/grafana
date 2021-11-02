import { __assign, __awaiter, __extends, __generator, __values } from "tslib";
import React, { PureComponent } from 'react';
// Components
import Page from 'app/core/components/Page/Page';
import { PluginSettings } from './PluginSettings';
import BasicSettings from './BasicSettings';
import ButtonRow from './ButtonRow';
// Services & Utils
import appEvents from 'app/core/app_events';
import { contextSrv } from 'app/core/core';
// Actions & selectors
import { getDataSource, getDataSourceMeta } from '../state/selectors';
import { deleteDataSource, initDataSourceSettings, loadDataSource, testDataSource, updateDataSource, } from '../state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
// Types
import { AccessControlAction } from 'app/types/';
import { urlUtil } from '@grafana/data';
import { Alert, Button } from '@grafana/ui';
import { getDataSourceLoadingNav, buildNavModel, getDataSourceNav } from '../state/navModel';
import { PluginStateInfo } from 'app/features/plugins/PluginStateInfo';
import { dataSourceLoaded, setDataSourceName, setIsDefault } from '../state/reducers';
import { selectors } from '@grafana/e2e-selectors';
import { CloudInfoBox } from './CloudInfoBox';
import { connect } from 'react-redux';
import { cleanUpAction } from 'app/core/actions/cleanUp';
import { ShowConfirmModalEvent } from '../../../types/events';
function mapStateToProps(state, props) {
    var dataSourceId = props.match.params.uid;
    var params = new URLSearchParams(props.location.search);
    var dataSource = getDataSource(state.dataSources, dataSourceId);
    var _a = state.dataSourceSettings, plugin = _a.plugin, loadError = _a.loadError, loading = _a.loading, testingStatus = _a.testingStatus;
    var page = params.get('page');
    var nav = plugin
        ? getDataSourceNav(buildNavModel(dataSource, plugin), page || 'settings')
        : getDataSourceLoadingNav('settings');
    var navModel = getNavModel(state.navIndex, page ? "datasource-page-" + page : "datasource-settings-" + dataSourceId, nav);
    return {
        dataSource: getDataSource(state.dataSources, dataSourceId),
        dataSourceMeta: getDataSourceMeta(state.dataSources, dataSource.type),
        dataSourceId: dataSourceId,
        page: page,
        plugin: plugin,
        loadError: loadError,
        loading: loading,
        testingStatus: testingStatus,
        navModel: navModel,
    };
}
var mapDispatchToProps = {
    deleteDataSource: deleteDataSource,
    loadDataSource: loadDataSource,
    setDataSourceName: setDataSourceName,
    updateDataSource: updateDataSource,
    setIsDefault: setIsDefault,
    dataSourceLoaded: dataSourceLoaded,
    initDataSourceSettings: initDataSourceSettings,
    testDataSource: testDataSource,
    cleanUpAction: cleanUpAction,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
var DataSourceSettingsPage = /** @class */ (function (_super) {
    __extends(DataSourceSettingsPage, _super);
    function DataSourceSettingsPage() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onSubmit = function (evt) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        evt.preventDefault();
                        return [4 /*yield*/, this.props.updateDataSource(__assign({}, this.props.dataSource))];
                    case 1:
                        _a.sent();
                        this.testDataSource();
                        return [2 /*return*/];
                }
            });
        }); };
        _this.onTest = function (evt) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                evt.preventDefault();
                this.testDataSource();
                return [2 /*return*/];
            });
        }); };
        _this.onDelete = function () {
            appEvents.publish(new ShowConfirmModalEvent({
                title: 'Delete',
                text: "Are you sure you want to delete the \"" + _this.props.dataSource.name + "\" data source?",
                yesText: 'Delete',
                icon: 'trash-alt',
                onConfirm: function () {
                    _this.confirmDelete();
                },
            }));
        };
        _this.confirmDelete = function () {
            _this.props.deleteDataSource();
        };
        _this.onModelChange = function (dataSource) {
            _this.props.dataSourceLoaded(dataSource);
        };
        return _this;
    }
    DataSourceSettingsPage.prototype.componentDidMount = function () {
        var _a = this.props, initDataSourceSettings = _a.initDataSourceSettings, dataSourceId = _a.dataSourceId;
        initDataSourceSettings(dataSourceId);
    };
    DataSourceSettingsPage.prototype.componentWillUnmount = function () {
        this.props.cleanUpAction({
            stateSelector: function (state) { return state.dataSourceSettings; },
        });
    };
    DataSourceSettingsPage.prototype.isReadOnly = function () {
        return this.props.dataSource.readOnly === true;
    };
    DataSourceSettingsPage.prototype.renderIsReadOnlyMessage = function () {
        return (React.createElement(Alert, { "aria-label": selectors.pages.DataSource.readOnly, severity: "info", title: "Provisioned data source" }, "This data source was added by config and cannot be modified using the UI. Please contact your server admin to update this data source."));
    };
    DataSourceSettingsPage.prototype.renderMissingEditRightsMessage = function () {
        return (React.createElement(Alert, { severity: "info", title: "Missing rights" }, "You are not allowed to modify this data source. Please contact your server admin to update this data source."));
    };
    DataSourceSettingsPage.prototype.testDataSource = function () {
        var _a = this.props, dataSource = _a.dataSource, testDataSource = _a.testDataSource;
        testDataSource(dataSource.name);
    };
    Object.defineProperty(DataSourceSettingsPage.prototype, "hasDataSource", {
        get: function () {
            return this.props.dataSource.id > 0;
        },
        enumerable: false,
        configurable: true
    });
    DataSourceSettingsPage.prototype.onNavigateToExplore = function () {
        var dataSource = this.props.dataSource;
        var exploreState = JSON.stringify({ datasource: dataSource.name, context: 'explore' });
        var url = urlUtil.renderUrl('/explore', { left: exploreState });
        return url;
    };
    DataSourceSettingsPage.prototype.renderLoadError = function () {
        var loadError = this.props.loadError;
        var canDeleteDataSources = !this.isReadOnly() && contextSrv.hasPermission(AccessControlAction.DataSourcesDelete);
        var node = {
            text: loadError,
            subTitle: 'Data Source Error',
            icon: 'exclamation-triangle',
        };
        var nav = {
            node: node,
            main: node,
        };
        return (React.createElement(Page, { navModel: nav },
            React.createElement(Page.Contents, { isLoading: this.props.loading },
                this.isReadOnly() && this.renderIsReadOnlyMessage(),
                React.createElement("div", { className: "gf-form-button-row" },
                    canDeleteDataSources && (React.createElement(Button, { type: "submit", variant: "destructive", onClick: this.onDelete }, "Delete")),
                    React.createElement(Button, { variant: "secondary", fill: "outline", type: "button", onClick: function () { return history.back(); } }, "Back")))));
    };
    DataSourceSettingsPage.prototype.renderConfigPageBody = function (page) {
        var e_1, _a;
        var plugin = this.props.plugin;
        if (!plugin || !plugin.configPages) {
            return null; // still loading
        }
        try {
            for (var _b = __values(plugin.configPages), _c = _b.next(); !_c.done; _c = _b.next()) {
                var p = _c.value;
                if (p.id === page) {
                    // Investigate is any plugins using this? We should change this interface
                    return React.createElement(p.body, { plugin: plugin, query: {} });
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return React.createElement("div", null,
            "Page not found: ",
            page);
    };
    DataSourceSettingsPage.prototype.renderAlertDetails = function () {
        var _a, _b, _c;
        var testingStatus = this.props.testingStatus;
        return (React.createElement(React.Fragment, null, (_a = testingStatus === null || testingStatus === void 0 ? void 0 : testingStatus.details) === null || _a === void 0 ? void 0 :
            _a.message,
            ((_b = testingStatus === null || testingStatus === void 0 ? void 0 : testingStatus.details) === null || _b === void 0 ? void 0 : _b.verboseMessage) ? (React.createElement("details", { style: { whiteSpace: 'pre-wrap' } }, (_c = testingStatus === null || testingStatus === void 0 ? void 0 : testingStatus.details) === null || _c === void 0 ? void 0 : _c.verboseMessage)) : null));
    };
    DataSourceSettingsPage.prototype.renderSettings = function () {
        var _this = this;
        var _a = this.props, dataSourceMeta = _a.dataSourceMeta, setDataSourceName = _a.setDataSourceName, setIsDefault = _a.setIsDefault, dataSource = _a.dataSource, plugin = _a.plugin, testingStatus = _a.testingStatus;
        var canEditDataSources = contextSrv.hasPermission(AccessControlAction.DataSourcesWrite);
        return (React.createElement("form", { onSubmit: this.onSubmit },
            !canEditDataSources && this.renderMissingEditRightsMessage(),
            this.isReadOnly() && this.renderIsReadOnlyMessage(),
            dataSourceMeta.state && (React.createElement("div", { className: "gf-form" },
                React.createElement("label", { className: "gf-form-label width-10" }, "Plugin state"),
                React.createElement("label", { className: "gf-form-label gf-form-label--transparent" },
                    React.createElement(PluginStateInfo, { state: dataSourceMeta.state })))),
            React.createElement(CloudInfoBox, { dataSource: dataSource }),
            React.createElement(BasicSettings, { dataSourceName: dataSource.name, isDefault: dataSource.isDefault, onDefaultChange: function (state) { return setIsDefault(state); }, onNameChange: function (name) { return setDataSourceName(name); } }),
            plugin && (React.createElement(PluginSettings, { plugin: plugin, dataSource: dataSource, dataSourceMeta: dataSourceMeta, onModelChange: this.onModelChange })),
            (testingStatus === null || testingStatus === void 0 ? void 0 : testingStatus.message) && (React.createElement("div", { className: "gf-form-group p-t-2" },
                React.createElement(Alert, { severity: testingStatus.status === 'error' ? 'error' : 'success', title: testingStatus.message, "aria-label": selectors.pages.DataSource.alert }, testingStatus.details && this.renderAlertDetails()))),
            React.createElement(ButtonRow, { onSubmit: function (event) { return _this.onSubmit(event); }, isReadOnly: this.isReadOnly(), onDelete: this.onDelete, onTest: function (event) { return _this.onTest(event); }, exploreUrl: this.onNavigateToExplore() })));
    };
    DataSourceSettingsPage.prototype.render = function () {
        var _a = this.props, navModel = _a.navModel, page = _a.page, loadError = _a.loadError, loading = _a.loading;
        if (loadError) {
            return this.renderLoadError();
        }
        return (React.createElement(Page, { navModel: navModel },
            React.createElement(Page.Contents, { isLoading: loading }, this.hasDataSource ? React.createElement("div", null, page ? this.renderConfigPageBody(page) : this.renderSettings()) : null)));
    };
    return DataSourceSettingsPage;
}(PureComponent));
export { DataSourceSettingsPage };
export default connector(DataSourceSettingsPage);
//# sourceMappingURL=DataSourceSettingsPage.js.map