import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Subscription } from 'rxjs';
import { PageLayoutType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Stack } from '@grafana/experimental';
import { locationService } from '@grafana/runtime';
import { Button, HorizontalGroup, InlineSwitch, ModalsController, RadioButtonGroup, stylesFactory, ToolbarButton, ToolbarButtonRow, withTheme2, } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { Page } from 'app/core/components/Page/Page';
import { SplitPaneWrapper } from 'app/core/components/SplitPaneWrapper/SplitPaneWrapper';
import { appEvents } from 'app/core/core';
import { SubMenuItems } from 'app/features/dashboard/components/SubMenu/SubMenuItems';
import { SaveLibraryPanelModal } from 'app/features/library-panels/components/SaveLibraryPanelModal/SaveLibraryPanelModal';
import { getPanelStateForModel } from 'app/features/panel/state/selectors';
import { updateTimeZoneForSession } from 'app/features/profile/state/reducers';
import { PanelOptionsChangedEvent, ShowModalReactEvent } from 'app/types/events';
import { notifyApp } from '../../../../core/actions';
import { UnlinkModal } from '../../../library-panels/components/UnlinkModal/UnlinkModal';
import { isPanelModelLibraryPanel } from '../../../library-panels/guard';
import { getVariablesByKey } from '../../../variables/state/selectors';
import { DashboardPanel } from '../../dashgrid/DashboardPanel';
import { DashNavTimeControls } from '../DashNav/DashNavTimeControls';
import { SaveDashboardDrawer } from '../SaveDashboard/SaveDashboardDrawer';
import { OptionsPane } from './OptionsPane';
import { PanelEditorTableView } from './PanelEditorTableView';
import { PanelEditorTabs } from './PanelEditorTabs';
import { VisualizationButton } from './VisualizationButton';
import { discardPanelChanges, initPanelEditor, updatePanelEditorUIState } from './state/actions';
import { toggleTableView } from './state/reducers';
import { getPanelEditorTabs } from './state/selectors';
import { displayModes } from './types';
import { calculatePanelSize } from './utils';
const mapStateToProps = (state, ownProps) => {
    const panel = state.panelEditor.getPanel();
    const panelState = getPanelStateForModel(state, panel);
    return {
        panel,
        plugin: panelState === null || panelState === void 0 ? void 0 : panelState.plugin,
        instanceState: panelState === null || panelState === void 0 ? void 0 : panelState.instanceState,
        initDone: state.panelEditor.initDone,
        uiState: state.panelEditor.ui,
        tableViewEnabled: state.panelEditor.tableViewEnabled,
        variables: getVariablesByKey(ownProps.dashboard.uid, state),
    };
};
const mapDispatchToProps = {
    initPanelEditor,
    discardPanelChanges,
    updatePanelEditorUIState,
    updateTimeZoneForSession,
    toggleTableView,
    notifyApp,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export class PanelEditorUnconnected extends PureComponent {
    constructor() {
        super(...arguments);
        this.state = {
            showSaveLibraryPanelModal: false,
        };
        this.triggerForceUpdate = () => {
            this.forceUpdate();
        };
        this.onBack = () => {
            locationService.partial({
                editPanel: null,
                tab: null,
                showCategory: null,
            });
        };
        this.onDiscard = () => {
            this.props.discardPanelChanges();
            this.onBack();
        };
        this.onSaveDashboard = () => {
            appEvents.publish(new ShowModalReactEvent({
                component: SaveDashboardDrawer,
                props: { dashboard: this.props.dashboard },
            }));
        };
        this.onSaveLibraryPanel = () => __awaiter(this, void 0, void 0, function* () {
            if (!isPanelModelLibraryPanel(this.props.panel)) {
                // New library panel, no need to display modal
                return;
            }
            this.setState({ showSaveLibraryPanelModal: true });
        });
        this.onChangeTab = (tab) => {
            locationService.partial({
                tab: tab.id,
            });
        };
        this.onFieldConfigChange = (config) => {
            // we do not need to trigger force update here as the function call below
            // fires PanelOptionsChangedEvent which we subscribe to above
            this.props.panel.updateFieldConfig(Object.assign({}, config));
        };
        this.onPanelOptionsChanged = (options) => {
            // we do not need to trigger force update here as the function call below
            // fires PanelOptionsChangedEvent which we subscribe to above
            this.props.panel.updateOptions(options);
        };
        this.onPanelConfigChanged = (configKey, value) => {
            this.props.panel.setProperty(configKey, value);
            this.props.panel.render();
            this.forceUpdate();
        };
        this.onDisplayModeChange = (mode) => {
            const { updatePanelEditorUIState } = this.props;
            if (this.props.tableViewEnabled) {
                this.props.toggleTableView();
            }
            updatePanelEditorUIState({
                mode: mode,
            });
        };
        this.onToggleTableView = () => {
            this.props.toggleTableView();
        };
        this.onGoBackToDashboard = () => {
            locationService.partial({ editPanel: null, tab: null, showCategory: null });
        };
        this.onConfirmAndDismissLibarayPanelModel = () => {
            this.setState({ showSaveLibraryPanelModal: false });
        };
    }
    componentDidMount() {
        this.props.initPanelEditor(this.props.sourcePanel, this.props.dashboard);
    }
    componentDidUpdate() {
        const { panel, initDone } = this.props;
        if (initDone && !this.eventSubs) {
            this.eventSubs = new Subscription();
            this.eventSubs.add(panel.events.subscribe(PanelOptionsChangedEvent, this.triggerForceUpdate));
        }
    }
    componentWillUnmount() {
        var _a;
        // redux action exitPanelEditor is called on location change from DashboardPrompt
        (_a = this.eventSubs) === null || _a === void 0 ? void 0 : _a.unsubscribe();
    }
    renderPanel(styles, isOnlyPanel) {
        const { dashboard, panel, uiState, tableViewEnabled, theme } = this.props;
        return (React.createElement("div", { className: styles.mainPaneWrapper, key: "panel" },
            this.renderPanelToolbar(styles),
            React.createElement("div", { className: styles.panelWrapper },
                React.createElement(AutoSizer, null, ({ width, height }) => {
                    if (width < 3 || height < 3) {
                        return null;
                    }
                    // If no tabs limit height so panel does not extend to edge
                    if (isOnlyPanel) {
                        height -= theme.spacing.gridSize * 2;
                    }
                    if (tableViewEnabled) {
                        return React.createElement(PanelEditorTableView, { width: width, height: height, panel: panel, dashboard: dashboard });
                    }
                    const panelSize = calculatePanelSize(uiState.mode, width, height, panel);
                    return (React.createElement("div", { className: styles.centeringContainer, style: { width, height } },
                        React.createElement("div", { style: panelSize, "data-panelid": panel.id },
                            React.createElement(DashboardPanel, { key: panel.key, stateKey: panel.key, dashboard: dashboard, panel: panel, isEditing: true, isViewing: false, lazy: false, width: panelSize.width, height: panelSize.height }))));
                }))));
    }
    renderPanelAndEditor(uiState, styles) {
        const { panel, dashboard, plugin, tab } = this.props;
        const tabs = getPanelEditorTabs(tab, plugin);
        const isOnlyPanel = tabs.length === 0;
        const panelPane = this.renderPanel(styles, isOnlyPanel);
        if (tabs.length === 0) {
            return React.createElement("div", { className: styles.onlyPanel }, panelPane);
        }
        return (React.createElement(SplitPaneWrapper, { splitOrientation: "horizontal", maxSize: -200, paneSize: uiState.topPaneSize, primary: "first", secondaryPaneStyle: { minHeight: 0 }, onDragFinished: (size) => {
                if (size) {
                    updatePanelEditorUIState({ topPaneSize: size / window.innerHeight });
                }
            } },
            panelPane,
            React.createElement("div", { className: styles.tabsWrapper, "aria-label": selectors.components.PanelEditor.DataPane.content, key: "panel-editor-tabs" },
                React.createElement(PanelEditorTabs, { key: panel.key, panel: panel, dashboard: dashboard, tabs: tabs, onChangeTab: this.onChangeTab }))));
    }
    renderTemplateVariables(styles) {
        const { variables } = this.props;
        if (!variables.length) {
            return null;
        }
        return (React.createElement("div", { className: styles.variablesWrapper },
            React.createElement(SubMenuItems, { variables: variables })));
    }
    renderPanelToolbar(styles) {
        const { dashboard, uiState, variables, updateTimeZoneForSession, panel, tableViewEnabled } = this.props;
        return (React.createElement("div", { className: styles.panelToolbar },
            React.createElement(HorizontalGroup, { justify: variables.length > 0 ? 'space-between' : 'flex-end', align: "flex-start" },
                this.renderTemplateVariables(styles),
                React.createElement(Stack, { gap: 1 },
                    React.createElement(InlineSwitch, { label: "Table view", showLabel: true, id: "table-view", value: tableViewEnabled, onClick: this.onToggleTableView, "aria-label": selectors.components.PanelEditor.toggleTableView }),
                    React.createElement(RadioButtonGroup, { value: uiState.mode, options: displayModes, onChange: this.onDisplayModeChange }),
                    React.createElement(DashNavTimeControls, { dashboard: dashboard, onChangeTimeZone: updateTimeZoneForSession, isOnCanvas: true }),
                    !uiState.isPanelOptionsVisible && React.createElement(VisualizationButton, { panel: panel })))));
    }
    renderEditorActions() {
        const size = 'sm';
        let editorActions = [
            React.createElement(Button, { onClick: this.onDiscard, title: "Undo all changes", key: "discard", size: size, variant: "destructive", fill: "outline" }, "Discard"),
            this.props.panel.libraryPanel ? (React.createElement(Button, { onClick: this.onSaveLibraryPanel, variant: "primary", size: size, title: "Apply changes and save library panel", key: "save-panel" }, "Save library panel")) : (React.createElement(Button, { onClick: this.onSaveDashboard, title: "Apply changes and save dashboard", key: "save", size: size, variant: "secondary" }, "Save")),
            React.createElement(Button, { onClick: this.onBack, variant: "primary", title: "Apply changes and go back to dashboard", "data-testid": selectors.components.PanelEditor.applyButton, key: "apply", size: size }, "Apply"),
        ];
        if (this.props.panel.libraryPanel) {
            editorActions.splice(1, 0, React.createElement(ModalsController, { key: "unlink-controller" }, ({ showModal, hideModal }) => {
                return (React.createElement(ToolbarButton, { onClick: () => {
                        showModal(UnlinkModal, {
                            onConfirm: () => {
                                this.props.panel.unlinkLibraryPanel();
                                this.forceUpdate();
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
    }
    renderOptionsPane() {
        const { plugin, dashboard, panel, instanceState } = this.props;
        if (!plugin) {
            return React.createElement("div", null);
        }
        return (React.createElement(OptionsPane, { plugin: plugin, dashboard: dashboard, panel: panel, instanceState: instanceState, onFieldConfigsChange: this.onFieldConfigChange, onPanelOptionsChanged: this.onPanelOptionsChanged, onPanelConfigChange: this.onPanelConfigChanged }));
    }
    render() {
        var _a;
        const { initDone, uiState, theme, sectionNav, pageNav, className, updatePanelEditorUIState } = this.props;
        const styles = getStyles(theme, this.props);
        if (!initDone) {
            return null;
        }
        return (React.createElement(Page, { navModel: sectionNav, pageNav: pageNav, "aria-label": selectors.components.PanelEditor.General.content, layout: PageLayoutType.Custom, className: className },
            React.createElement(AppChromeUpdate, { actions: React.createElement(ToolbarButtonRow, { alignment: "right" }, this.renderEditorActions()) }),
            React.createElement("div", { className: styles.wrapper },
                React.createElement("div", { className: styles.verticalSplitPanesWrapper }, !uiState.isPanelOptionsVisible ? (this.renderPanelAndEditor(uiState, styles)) : (React.createElement(SplitPaneWrapper, { splitOrientation: "vertical", maxSize: -300, paneSize: uiState.rightPaneSize, primary: "second", onDragFinished: (size) => {
                        if (size) {
                            updatePanelEditorUIState({ rightPaneSize: size / window.innerWidth });
                        }
                    } },
                    this.renderPanelAndEditor(uiState, styles),
                    this.renderOptionsPane()))),
                this.state.showSaveLibraryPanelModal && (React.createElement(SaveLibraryPanelModal, { panel: this.props.panel, folderUid: (_a = this.props.dashboard.meta.folderUid) !== null && _a !== void 0 ? _a : '', onConfirm: this.onConfirmAndDismissLibarayPanelModel, onDiscard: this.onDiscard, onDismiss: this.onConfirmAndDismissLibarayPanelModel })))));
    }
}
export const PanelEditor = withTheme2(connector(PanelEditorUnconnected));
/*
 * Styles
 */
export const getStyles = stylesFactory((theme, props) => {
    const { uiState } = props;
    const paneSpacing = theme.spacing(2);
    return {
        wrapper: css({
            width: '100%',
            flexGrow: 1,
            minHeight: 0,
            display: 'flex',
            paddingTop: theme.spacing(2),
        }),
        verticalSplitPanesWrapper: css `
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      position: relative;
    `,
        mainPaneWrapper: css `
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      padding-right: ${uiState.isPanelOptionsVisible ? 0 : paneSpacing};
    `,
        variablesWrapper: css `
      label: variablesWrapper;
      display: flex;
      flex-grow: 1;
      flex-wrap: wrap;
      gap: ${theme.spacing(1, 2)};
    `,
        panelWrapper: css `
      flex: 1 1 0;
      min-height: 0;
      width: 100%;
      padding-left: ${paneSpacing};
    `,
        tabsWrapper: css `
      height: 100%;
      width: 100%;
    `,
        panelToolbar: css `
      display: flex;
      padding: 0 0 ${paneSpacing} ${paneSpacing};
      justify-content: space-between;
      flex-wrap: wrap;
    `,
        angularWarning: css `
      display: flex;
      height: theme.spacing(4);
      align-items: center;
    `,
        toolbarLeft: css `
      padding-left: ${theme.spacing(1)};
    `,
        centeringContainer: css `
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;
      flex-direction: column;
    `,
        onlyPanel: css `
      height: 100%;
      position: absolute;
      overflow: hidden;
      width: 100%;
    `,
    };
});
//# sourceMappingURL=PanelEditor.js.map