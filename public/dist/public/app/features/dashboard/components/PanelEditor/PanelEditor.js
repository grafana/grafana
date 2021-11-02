import { __assign, __awaiter, __extends, __generator, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import AutoSizer from 'react-virtualized-auto-sizer';
import { css } from '@emotion/css';
import { Subscription } from 'rxjs';
import { selectors } from '@grafana/e2e-selectors';
import { HorizontalGroup, InlineSwitch, ModalsController, PageToolbar, RadioButtonGroup, stylesFactory, ToolbarButton, } from '@grafana/ui';
import config from 'app/core/config';
import { appEvents } from 'app/core/core';
import { calculatePanelSize } from './utils';
import { PanelEditorTabs } from './PanelEditorTabs';
import { DashNavTimeControls } from '../DashNav/DashNavTimeControls';
import { OptionsPane } from './OptionsPane';
import { SubMenuItems } from 'app/features/dashboard/components/SubMenu/SubMenuItems';
import { SplitPaneWrapper } from 'app/core/components/SplitPaneWrapper/SplitPaneWrapper';
import { SaveDashboardModalProxy } from '../SaveDashboard/SaveDashboardModalProxy';
import { DashboardPanel } from '../../dashgrid/DashboardPanel';
import { discardPanelChanges, initPanelEditor, updatePanelEditorUIState } from './state/actions';
import { updateTimeZoneForSession } from 'app/features/profile/state/reducers';
import { toggleTableView } from './state/reducers';
import { getPanelEditorTabs } from './state/selectors';
import { getVariables } from 'app/features/variables/state/selectors';
import { displayModes } from './types';
import { VisualizationButton } from './VisualizationButton';
import { PanelOptionsChangedEvent, ShowModalReactEvent } from 'app/types/events';
import { locationService } from '@grafana/runtime';
import { UnlinkModal } from '../../../library-panels/components/UnlinkModal/UnlinkModal';
import { SaveLibraryPanelModal } from 'app/features/library-panels/components/SaveLibraryPanelModal/SaveLibraryPanelModal';
import { isPanelModelLibraryPanel } from '../../../library-panels/guard';
import { getLibraryPanelConnectedDashboards } from '../../../library-panels/state/api';
import { createPanelLibraryErrorNotification, createPanelLibrarySuccessNotification, saveAndRefreshLibraryPanel, } from '../../../library-panels/utils';
import { notifyApp } from '../../../../core/actions';
import { PanelEditorTableView } from './PanelEditorTableView';
import { getPanelStateForModel } from 'app/features/panel/state/selectors';
var mapStateToProps = function (state) {
    var panel = state.panelEditor.getPanel();
    var panelState = getPanelStateForModel(state, panel);
    return {
        panel: panel,
        plugin: panelState === null || panelState === void 0 ? void 0 : panelState.plugin,
        instanceState: panelState === null || panelState === void 0 ? void 0 : panelState.instanceState,
        initDone: state.panelEditor.initDone,
        uiState: state.panelEditor.ui,
        tableViewEnabled: state.panelEditor.tableViewEnabled,
        variables: getVariables(state),
    };
};
var mapDispatchToProps = {
    initPanelEditor: initPanelEditor,
    discardPanelChanges: discardPanelChanges,
    updatePanelEditorUIState: updatePanelEditorUIState,
    updateTimeZoneForSession: updateTimeZoneForSession,
    toggleTableView: toggleTableView,
    notifyApp: notifyApp,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
var PanelEditorUnconnected = /** @class */ (function (_super) {
    __extends(PanelEditorUnconnected, _super);
    function PanelEditorUnconnected() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            showSaveLibraryPanelModal: false,
        };
        _this.triggerForceUpdate = function () {
            _this.forceUpdate();
        };
        _this.onBack = function () {
            locationService.partial({
                editPanel: null,
                tab: null,
            });
        };
        _this.onDiscard = function () {
            _this.props.discardPanelChanges();
            _this.onBack();
        };
        _this.onOpenDashboardSettings = function () {
            locationService.partial({
                editview: 'settings',
            });
        };
        _this.onSaveDashboard = function () {
            appEvents.publish(new ShowModalReactEvent({
                component: SaveDashboardModalProxy,
                props: { dashboard: _this.props.dashboard },
            }));
        };
        _this.onSaveLibraryPanel = function () { return __awaiter(_this, void 0, void 0, function () {
            var connectedDashboards, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!isPanelModelLibraryPanel(this.props.panel)) {
                            // New library panel, no need to display modal
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, getLibraryPanelConnectedDashboards(this.props.panel.libraryPanel.uid)];
                    case 1:
                        connectedDashboards = _a.sent();
                        if (!(connectedDashboards.length === 0 ||
                            (connectedDashboards.length === 1 && connectedDashboards.includes(this.props.dashboard.id)))) return [3 /*break*/, 6];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, saveAndRefreshLibraryPanel(this.props.panel, this.props.dashboard.meta.folderId)];
                    case 3:
                        _a.sent();
                        this.props.notifyApp(createPanelLibrarySuccessNotification('Library panel saved'));
                        return [3 /*break*/, 5];
                    case 4:
                        err_1 = _a.sent();
                        this.props.notifyApp(createPanelLibraryErrorNotification("Error saving library panel: \"" + err_1.statusText + "\""));
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                    case 6:
                        this.setState({ showSaveLibraryPanelModal: true });
                        return [2 /*return*/];
                }
            });
        }); };
        _this.onChangeTab = function (tab) {
            locationService.partial({
                tab: tab.id,
            });
        };
        _this.onFieldConfigChange = function (config) {
            // we do not need to trigger force update here as the function call below
            // fires PanelOptionsChangedEvent which we subscribe to above
            _this.props.panel.updateFieldConfig(__assign({}, config));
        };
        _this.onPanelOptionsChanged = function (options) {
            // we do not need to trigger force update here as the function call below
            // fires PanelOptionsChangedEvent which we subscribe to above
            _this.props.panel.updateOptions(options);
        };
        _this.onPanelConfigChanged = function (configKey, value) {
            _this.props.panel.setProperty(configKey, value);
            _this.props.panel.render();
            _this.forceUpdate();
        };
        _this.onDisplayModeChange = function (mode) {
            var updatePanelEditorUIState = _this.props.updatePanelEditorUIState;
            if (_this.props.tableViewEnabled) {
                _this.props.toggleTableView();
            }
            updatePanelEditorUIState({
                mode: mode,
            });
        };
        _this.onToggleTableView = function () {
            _this.props.toggleTableView();
        };
        _this.onTogglePanelOptions = function () {
            var _a = _this.props, uiState = _a.uiState, updatePanelEditorUIState = _a.updatePanelEditorUIState;
            updatePanelEditorUIState({ isPanelOptionsVisible: !uiState.isPanelOptionsVisible });
        };
        _this.onGoBackToDashboard = function () {
            locationService.partial({ editPanel: null, tab: null });
        };
        _this.onConfirmAndDismissLibarayPanelModel = function () {
            _this.setState({ showSaveLibraryPanelModal: false });
        };
        return _this;
    }
    PanelEditorUnconnected.prototype.componentDidMount = function () {
        this.props.initPanelEditor(this.props.sourcePanel, this.props.dashboard);
    };
    PanelEditorUnconnected.prototype.componentDidUpdate = function () {
        var _a = this.props, panel = _a.panel, initDone = _a.initDone;
        if (initDone && !this.eventSubs) {
            this.eventSubs = new Subscription();
            this.eventSubs.add(panel.events.subscribe(PanelOptionsChangedEvent, this.triggerForceUpdate));
        }
    };
    PanelEditorUnconnected.prototype.componentWillUnmount = function () {
        var _a;
        // redux action exitPanelEditor is called on location change from DashboardPrompt
        (_a = this.eventSubs) === null || _a === void 0 ? void 0 : _a.unsubscribe();
    };
    PanelEditorUnconnected.prototype.renderPanel = function (styles, isOnlyPanel) {
        var _a = this.props, dashboard = _a.dashboard, panel = _a.panel, uiState = _a.uiState, tableViewEnabled = _a.tableViewEnabled;
        return (React.createElement("div", { className: styles.mainPaneWrapper, key: "panel" },
            this.renderPanelToolbar(styles),
            React.createElement("div", { className: styles.panelWrapper },
                React.createElement(AutoSizer, null, function (_a) {
                    var width = _a.width, height = _a.height;
                    if (width < 3 || height < 3) {
                        return null;
                    }
                    // If no tabs limit height so panel does not extend to edge
                    if (isOnlyPanel) {
                        height -= config.theme2.spacing.gridSize * 2;
                    }
                    if (tableViewEnabled) {
                        return React.createElement(PanelEditorTableView, { width: width, height: height, panel: panel, dashboard: dashboard });
                    }
                    var panelSize = calculatePanelSize(uiState.mode, width, height, panel);
                    return (React.createElement("div", { className: styles.centeringContainer, style: { width: width, height: height } },
                        React.createElement("div", { style: panelSize, "data-panelid": panel.id },
                            React.createElement(DashboardPanel, { key: panel.key, stateKey: panel.key, dashboard: dashboard, panel: panel, isEditing: true, isViewing: false, isInView: true, width: panelSize.width, height: panelSize.height, skipStateCleanUp: true }))));
                }))));
    };
    PanelEditorUnconnected.prototype.renderPanelAndEditor = function (styles) {
        var _a = this.props, panel = _a.panel, dashboard = _a.dashboard, plugin = _a.plugin, tab = _a.tab;
        var tabs = getPanelEditorTabs(tab, plugin);
        var isOnlyPanel = tabs.length === 0;
        var panelPane = this.renderPanel(styles, isOnlyPanel);
        if (tabs.length === 0) {
            return panelPane;
        }
        return [
            panelPane,
            React.createElement("div", { className: styles.tabsWrapper, "aria-label": selectors.components.PanelEditor.DataPane.content, key: "panel-editor-tabs" },
                React.createElement(PanelEditorTabs, { panel: panel, dashboard: dashboard, tabs: tabs, onChangeTab: this.onChangeTab })),
        ];
    };
    PanelEditorUnconnected.prototype.renderTemplateVariables = function (styles) {
        var variables = this.props.variables;
        if (!variables.length) {
            return null;
        }
        return (React.createElement("div", { className: styles.variablesWrapper },
            React.createElement(SubMenuItems, { variables: variables })));
    };
    PanelEditorUnconnected.prototype.renderPanelToolbar = function (styles) {
        var _a = this.props, dashboard = _a.dashboard, uiState = _a.uiState, variables = _a.variables, updateTimeZoneForSession = _a.updateTimeZoneForSession, panel = _a.panel, tableViewEnabled = _a.tableViewEnabled;
        return (React.createElement("div", { className: styles.panelToolbar },
            React.createElement(HorizontalGroup, { justify: variables.length > 0 ? 'space-between' : 'flex-end', align: "flex-start" },
                this.renderTemplateVariables(styles),
                React.createElement(HorizontalGroup, null,
                    React.createElement(InlineSwitch, { label: "Table view", showLabel: true, id: "table-view", value: tableViewEnabled, onClick: this.onToggleTableView, "aria-label": selectors.components.PanelEditor.toggleTableView }),
                    React.createElement(RadioButtonGroup, { value: uiState.mode, options: displayModes, onChange: this.onDisplayModeChange }),
                    React.createElement(DashNavTimeControls, { dashboard: dashboard, onChangeTimeZone: updateTimeZoneForSession }),
                    !uiState.isPanelOptionsVisible && React.createElement(VisualizationButton, { panel: panel })))));
    };
    PanelEditorUnconnected.prototype.renderEditorActions = function () {
        var _this = this;
        var editorActions = [
            React.createElement(ToolbarButton, { icon: "cog", onClick: this.onOpenDashboardSettings, title: "Open dashboard settings", key: "settings" }),
            React.createElement(ToolbarButton, { onClick: this.onDiscard, title: "Undo all changes", key: "discard" }, "Discard"),
            this.props.panel.libraryPanel ? (React.createElement(ToolbarButton, { onClick: this.onSaveLibraryPanel, variant: "primary", title: "Apply changes and save library panel", key: "save-panel" }, "Save library panel")) : (React.createElement(ToolbarButton, { onClick: this.onSaveDashboard, title: "Apply changes and save dashboard", key: "save" }, "Save")),
            React.createElement(ToolbarButton, { onClick: this.onBack, variant: "primary", title: "Apply changes and go back to dashboard", key: "apply", "aria-label": selectors.components.PanelEditor.applyButton }, "Apply"),
        ];
        if (this.props.panel.libraryPanel) {
            editorActions.splice(1, 0, React.createElement(ModalsController, { key: "unlink-controller" }, function (_a) {
                var showModal = _a.showModal, hideModal = _a.hideModal;
                return (React.createElement(ToolbarButton, { onClick: function () {
                        showModal(UnlinkModal, {
                            onConfirm: function () {
                                delete _this.props.panel.libraryPanel;
                                _this.props.panel.render();
                                _this.forceUpdate();
                            },
                            onDismiss: hideModal,
                            isOpen: true,
                        });
                    }, title: "Disconnects this panel from the library panel so that you can edit it regularly.", key: "unlink" }, "Unlink"));
            }));
            // Remove "Apply" button
            editorActions.pop();
        }
        return editorActions;
    };
    PanelEditorUnconnected.prototype.renderOptionsPane = function () {
        var _a = this.props, plugin = _a.plugin, dashboard = _a.dashboard, panel = _a.panel, instanceState = _a.instanceState;
        if (!plugin) {
            return React.createElement("div", null);
        }
        return (React.createElement(OptionsPane, { plugin: plugin, dashboard: dashboard, panel: panel, instanceState: instanceState, onFieldConfigsChange: this.onFieldConfigChange, onPanelOptionsChanged: this.onPanelOptionsChanged, onPanelConfigChange: this.onPanelConfigChanged }));
    };
    PanelEditorUnconnected.prototype.render = function () {
        var _a = this.props, dashboard = _a.dashboard, initDone = _a.initDone, updatePanelEditorUIState = _a.updatePanelEditorUIState, uiState = _a.uiState;
        var styles = getStyles(config.theme, this.props);
        if (!initDone) {
            return null;
        }
        return (React.createElement("div", { className: styles.wrapper, "aria-label": selectors.components.PanelEditor.General.content },
            React.createElement(PageToolbar, { title: dashboard.title + " / Edit Panel", onGoBack: this.onGoBackToDashboard }, this.renderEditorActions()),
            React.createElement("div", { className: styles.verticalSplitPanesWrapper },
                React.createElement(SplitPaneWrapper, { leftPaneComponents: this.renderPanelAndEditor(styles), rightPaneComponents: this.renderOptionsPane(), uiState: uiState, updateUiState: updatePanelEditorUIState, rightPaneVisible: uiState.isPanelOptionsVisible })),
            this.state.showSaveLibraryPanelModal && (React.createElement(SaveLibraryPanelModal, { panel: this.props.panel, folderId: this.props.dashboard.meta.folderId, onConfirm: this.onConfirmAndDismissLibarayPanelModel, onDiscard: this.onDiscard, onDismiss: this.onConfirmAndDismissLibarayPanelModel }))));
    };
    return PanelEditorUnconnected;
}(PureComponent));
export { PanelEditorUnconnected };
export var PanelEditor = connector(PanelEditorUnconnected);
/*
 * Styles
 */
export var getStyles = stylesFactory(function (theme, props) {
    var uiState = props.uiState;
    var paneSpacing = theme.spacing.md;
    return {
        wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      width: 100%;\n      height: 100%;\n      position: fixed;\n      z-index: ", ";\n      top: 0;\n      left: 0;\n      right: 0;\n      bottom: 0;\n      background: ", ";\n      display: flex;\n      flex-direction: column;\n    "], ["\n      width: 100%;\n      height: 100%;\n      position: fixed;\n      z-index: ", ";\n      top: 0;\n      left: 0;\n      right: 0;\n      bottom: 0;\n      background: ", ";\n      display: flex;\n      flex-direction: column;\n    "])), theme.zIndex.sidemenu, theme.colors.dashboardBg),
        verticalSplitPanesWrapper: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: column;\n      height: 100%;\n      width: 100%;\n      position: relative;\n    "], ["\n      display: flex;\n      flex-direction: column;\n      height: 100%;\n      width: 100%;\n      position: relative;\n    "]))),
        mainPaneWrapper: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: column;\n      height: 100%;\n      width: 100%;\n      padding-right: ", ";\n    "], ["\n      display: flex;\n      flex-direction: column;\n      height: 100%;\n      width: 100%;\n      padding-right: ", ";\n    "])), uiState.isPanelOptionsVisible ? 0 : paneSpacing),
        variablesWrapper: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      label: variablesWrapper;\n      display: flex;\n      flex-grow: 1;\n      flex-wrap: wrap;\n    "], ["\n      label: variablesWrapper;\n      display: flex;\n      flex-grow: 1;\n      flex-wrap: wrap;\n    "]))),
        panelWrapper: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      flex: 1 1 0;\n      min-height: 0;\n      width: 100%;\n      padding-left: ", ";\n    "], ["\n      flex: 1 1 0;\n      min-height: 0;\n      width: 100%;\n      padding-left: ", ";\n    "])), paneSpacing),
        tabsWrapper: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      height: 100%;\n      width: 100%;\n    "], ["\n      height: 100%;\n      width: 100%;\n    "]))),
        panelToolbar: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      display: flex;\n      padding: 0 0 ", " ", ";\n      justify-content: space-between;\n      flex-wrap: wrap;\n    "], ["\n      display: flex;\n      padding: 0 0 ", " ", ";\n      justify-content: space-between;\n      flex-wrap: wrap;\n    "])), paneSpacing, paneSpacing),
        toolbarLeft: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      padding-left: ", ";\n    "], ["\n      padding-left: ", ";\n    "])), theme.spacing.sm),
        centeringContainer: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n      display: flex;\n      justify-content: center;\n      align-items: center;\n      position: relative;\n      flex-direction: column;\n    "], ["\n      display: flex;\n      justify-content: center;\n      align-items: center;\n      position: relative;\n      flex-direction: column;\n    "]))),
    };
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9;
//# sourceMappingURL=PanelEditor.js.map