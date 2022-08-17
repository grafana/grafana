import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Subscription } from 'rxjs';

import { FieldConfigSource, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { isFetchError, locationService } from '@grafana/runtime';
import {
  HorizontalGroup,
  InlineSwitch,
  ModalsController,
  PageToolbar,
  RadioButtonGroup,
  stylesFactory,
  Themeable2,
  ToolbarButton,
  withTheme2,
} from '@grafana/ui';
import { SplitPaneWrapper } from 'app/core/components/SplitPaneWrapper/SplitPaneWrapper';
import { appEvents } from 'app/core/core';
import { SubMenuItems } from 'app/features/dashboard/components/SubMenu/SubMenuItems';
import { SaveLibraryPanelModal } from 'app/features/library-panels/components/SaveLibraryPanelModal/SaveLibraryPanelModal';
import { PanelModelWithLibraryPanel } from 'app/features/library-panels/types';
import { getPanelStateForModel } from 'app/features/panel/state/selectors';
import { updateTimeZoneForSession } from 'app/features/profile/state/reducers';
import { StoreState } from 'app/types';
import { PanelOptionsChangedEvent, ShowModalReactEvent } from 'app/types/events';

import { notifyApp } from '../../../../core/actions';
import { UnlinkModal } from '../../../library-panels/components/UnlinkModal/UnlinkModal';
import { isPanelModelLibraryPanel } from '../../../library-panels/guard';
import { getLibraryPanelConnectedDashboards } from '../../../library-panels/state/api';
import {
  createPanelLibraryErrorNotification,
  createPanelLibrarySuccessNotification,
  saveAndRefreshLibraryPanel,
} from '../../../library-panels/utils';
import { getVariablesByKey } from '../../../variables/state/selectors';
import { DashboardPanel } from '../../dashgrid/DashboardPanel';
import { DashboardModel, PanelModel } from '../../state';
import { DashNavTimeControls } from '../DashNav/DashNavTimeControls';
import { SaveDashboardDrawer } from '../SaveDashboard/SaveDashboardDrawer';

import { OptionsPane } from './OptionsPane';
import { PanelEditorTableView } from './PanelEditorTableView';
import { PanelEditorTabs } from './PanelEditorTabs';
import { VisualizationButton } from './VisualizationButton';
import { discardPanelChanges, initPanelEditor, updatePanelEditorUIState } from './state/actions';
import { toggleTableView } from './state/reducers';
import { getPanelEditorTabs } from './state/selectors';
import { DisplayMode, displayModes, PanelEditorTab } from './types';
import { calculatePanelSize } from './utils';

interface OwnProps {
  dashboard: DashboardModel;
  sourcePanel: PanelModel;
  tab?: string;
}

const mapStateToProps = (state: StoreState, ownProps: OwnProps) => {
  const panel = state.panelEditor.getPanel();
  const panelState = getPanelStateForModel(state, panel);

  return {
    panel,
    plugin: panelState?.plugin,
    instanceState: panelState?.instanceState,
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

type Props = OwnProps & ConnectedProps<typeof connector> & Themeable2;

interface State {
  showSaveLibraryPanelModal?: boolean;
}

export class PanelEditorUnconnected extends PureComponent<Props> {
  private eventSubs?: Subscription;

  state: State = {
    showSaveLibraryPanelModal: false,
  };

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
    // redux action exitPanelEditor is called on location change from DashboardPrompt
    this.eventSubs?.unsubscribe();
  }

  triggerForceUpdate = () => {
    this.forceUpdate();
  };

  onBack = () => {
    locationService.partial({
      editPanel: null,
      tab: null,
      showCategory: null,
    });
  };

  onDiscard = () => {
    this.props.discardPanelChanges();
    this.onBack();
  };

  onOpenDashboardSettings = () => {
    locationService.partial({
      editview: 'settings',
    });
  };

  onSaveDashboard = () => {
    appEvents.publish(
      new ShowModalReactEvent({
        component: SaveDashboardDrawer,
        props: { dashboard: this.props.dashboard },
      })
    );
  };

  onSaveLibraryPanel = async () => {
    if (!isPanelModelLibraryPanel(this.props.panel)) {
      // New library panel, no need to display modal
      return;
    }

    const connectedDashboards = await getLibraryPanelConnectedDashboards(this.props.panel.libraryPanel.uid);
    if (
      connectedDashboards.length === 0 ||
      (connectedDashboards.length === 1 && connectedDashboards.includes(this.props.dashboard.id))
    ) {
      try {
        await saveAndRefreshLibraryPanel(this.props.panel, this.props.dashboard.meta.folderId!);
        this.props.notifyApp(createPanelLibrarySuccessNotification('Library panel saved'));
      } catch (err) {
        if (isFetchError(err)) {
          this.props.notifyApp(createPanelLibraryErrorNotification(`Error saving library panel: "${err.statusText}"`));
        }
      }
      return;
    }

    this.setState({ showSaveLibraryPanelModal: true });
  };

  onChangeTab = (tab: PanelEditorTab) => {
    locationService.partial({
      tab: tab.id,
    });
  };

  onFieldConfigChange = (config: FieldConfigSource) => {
    // we do not need to trigger force update here as the function call below
    // fires PanelOptionsChangedEvent which we subscribe to above
    this.props.panel.updateFieldConfig({
      ...config,
    });
  };

  onPanelOptionsChanged = (options: any) => {
    // we do not need to trigger force update here as the function call below
    // fires PanelOptionsChangedEvent which we subscribe to above
    this.props.panel.updateOptions(options);
  };

  onPanelConfigChanged = (configKey: keyof PanelModel, value: any) => {
    this.props.panel.setProperty(configKey, value);
    this.props.panel.render();
    this.forceUpdate();
  };

  onDisplayModeChange = (mode?: DisplayMode) => {
    const { updatePanelEditorUIState } = this.props;
    if (this.props.tableViewEnabled) {
      this.props.toggleTableView();
    }
    updatePanelEditorUIState({
      mode: mode,
    });
  };

  onToggleTableView = () => {
    this.props.toggleTableView();
  };

  onTogglePanelOptions = () => {
    const { uiState, updatePanelEditorUIState } = this.props;
    updatePanelEditorUIState({ isPanelOptionsVisible: !uiState.isPanelOptionsVisible });
  };

  renderPanel(styles: EditorStyles, isOnlyPanel: boolean) {
    const { dashboard, panel, uiState, tableViewEnabled, theme } = this.props;

    return (
      <div className={styles.mainPaneWrapper} key="panel">
        {this.renderPanelToolbar(styles)}
        <div className={styles.panelWrapper}>
          <AutoSizer>
            {({ width, height }) => {
              if (width < 3 || height < 3) {
                return null;
              }

              // If no tabs limit height so panel does not extend to edge
              if (isOnlyPanel) {
                height -= theme.spacing.gridSize * 2;
              }

              if (tableViewEnabled) {
                return <PanelEditorTableView width={width} height={height} panel={panel} dashboard={dashboard} />;
              }

              const panelSize = calculatePanelSize(uiState.mode, width, height, panel);

              return (
                <div className={styles.centeringContainer} style={{ width, height }}>
                  <div style={panelSize} data-panelid={panel.id}>
                    <DashboardPanel
                      key={panel.key}
                      stateKey={panel.key}
                      dashboard={dashboard}
                      panel={panel}
                      isEditing={true}
                      isViewing={false}
                      lazy={false}
                      width={panelSize.width}
                      height={panelSize.height}
                    />
                  </div>
                </div>
              );
            }}
          </AutoSizer>
        </div>
      </div>
    );
  }

  renderPanelAndEditor(styles: EditorStyles) {
    const { panel, dashboard, plugin, tab } = this.props;
    const tabs = getPanelEditorTabs(tab, plugin);
    const isOnlyPanel = tabs.length === 0;
    const panelPane = this.renderPanel(styles, isOnlyPanel);

    if (tabs.length === 0) {
      return panelPane;
    }

    return [
      panelPane,
      <div
        className={styles.tabsWrapper}
        aria-label={selectors.components.PanelEditor.DataPane.content}
        key="panel-editor-tabs"
      >
        <PanelEditorTabs
          key={panel.key}
          panel={panel}
          dashboard={dashboard}
          tabs={tabs}
          onChangeTab={this.onChangeTab}
        />
      </div>,
    ];
  }

  renderTemplateVariables(styles: EditorStyles) {
    const { variables } = this.props;

    if (!variables.length) {
      return null;
    }

    return (
      <div className={styles.variablesWrapper}>
        <SubMenuItems variables={variables} />
      </div>
    );
  }

  renderPanelToolbar(styles: EditorStyles) {
    const { dashboard, uiState, variables, updateTimeZoneForSession, panel, tableViewEnabled } = this.props;

    return (
      <div className={styles.panelToolbar}>
        <HorizontalGroup justify={variables.length > 0 ? 'space-between' : 'flex-end'} align="flex-start">
          {this.renderTemplateVariables(styles)}
          <HorizontalGroup>
            <InlineSwitch
              label="Table view"
              showLabel={true}
              id="table-view"
              value={tableViewEnabled}
              onClick={this.onToggleTableView}
              aria-label={selectors.components.PanelEditor.toggleTableView}
            />
            <RadioButtonGroup value={uiState.mode} options={displayModes} onChange={this.onDisplayModeChange} />
            <DashNavTimeControls dashboard={dashboard} onChangeTimeZone={updateTimeZoneForSession} />
            {!uiState.isPanelOptionsVisible && <VisualizationButton panel={panel} />}
          </HorizontalGroup>
        </HorizontalGroup>
      </div>
    );
  }

  renderEditorActions() {
    let editorActions = [
      <ToolbarButton
        icon="cog"
        onClick={this.onOpenDashboardSettings}
        tooltip="Open dashboard settings"
        key="settings"
      />,
      <ToolbarButton onClick={this.onDiscard} tooltip="Undo all changes" key="discard">
        Discard
      </ToolbarButton>,
      this.props.panel.libraryPanel ? (
        <ToolbarButton
          onClick={this.onSaveLibraryPanel}
          variant="primary"
          tooltip="Apply changes and save library panel"
          key="save-panel"
        >
          Save library panel
        </ToolbarButton>
      ) : (
        <ToolbarButton onClick={this.onSaveDashboard} tooltip="Apply changes and save dashboard" key="save">
          Save
        </ToolbarButton>
      ),
      <ToolbarButton
        onClick={this.onBack}
        variant="primary"
        tooltip="Apply changes and go back to dashboard"
        key="apply"
      >
        Apply
      </ToolbarButton>,
    ];

    if (this.props.panel.libraryPanel) {
      editorActions.splice(
        1,
        0,
        <ModalsController key="unlink-controller">
          {({ showModal, hideModal }) => {
            return (
              <ToolbarButton
                onClick={() => {
                  showModal(UnlinkModal, {
                    onConfirm: () => {
                      delete this.props.panel.libraryPanel;
                      this.props.panel.render();
                      this.forceUpdate();
                    },
                    onDismiss: hideModal,
                    isOpen: true,
                  });
                }}
                title="Disconnects this panel from the library panel so that you can edit it regularly."
                key="unlink"
              >
                Unlink
              </ToolbarButton>
            );
          }}
        </ModalsController>
      );

      // Remove "Apply" button
      editorActions.pop();
    }

    return editorActions;
  }

  renderOptionsPane() {
    const { plugin, dashboard, panel, instanceState } = this.props;

    if (!plugin) {
      return <div />;
    }

    return (
      <OptionsPane
        plugin={plugin}
        dashboard={dashboard}
        panel={panel}
        instanceState={instanceState}
        onFieldConfigsChange={this.onFieldConfigChange}
        onPanelOptionsChanged={this.onPanelOptionsChanged}
        onPanelConfigChange={this.onPanelConfigChanged}
      />
    );
  }

  onGoBackToDashboard = () => {
    locationService.partial({ editPanel: null, tab: null, showCategory: null });
  };

  onConfirmAndDismissLibarayPanelModel = () => {
    this.setState({ showSaveLibraryPanelModal: false });
  };

  render() {
    const { dashboard, initDone, updatePanelEditorUIState, uiState, theme } = this.props;
    const styles = getStyles(theme, this.props);

    if (!initDone) {
      return null;
    }

    return (
      <div className={styles.wrapper} aria-label={selectors.components.PanelEditor.General.content}>
        <PageToolbar title={dashboard.title} section="Edit Panel" onGoBack={this.onGoBackToDashboard}>
          {this.renderEditorActions()}
        </PageToolbar>
        <div className={styles.verticalSplitPanesWrapper}>
          <SplitPaneWrapper
            leftPaneComponents={this.renderPanelAndEditor(styles)}
            rightPaneComponents={this.renderOptionsPane()}
            uiState={uiState}
            updateUiState={updatePanelEditorUIState}
            rightPaneVisible={uiState.isPanelOptionsVisible}
          />
        </div>
        {this.state.showSaveLibraryPanelModal && (
          <SaveLibraryPanelModal
            panel={this.props.panel as PanelModelWithLibraryPanel}
            folderId={this.props.dashboard.meta.folderId as number}
            onConfirm={this.onConfirmAndDismissLibarayPanelModel}
            onDiscard={this.onDiscard}
            onDismiss={this.onConfirmAndDismissLibarayPanelModel}
          />
        )}
      </div>
    );
  }
}

export const PanelEditor = withTheme2(connector(PanelEditorUnconnected));

/*
 * Styles
 */
export const getStyles = stylesFactory((theme: GrafanaTheme2, props: Props) => {
  const { uiState } = props;
  const paneSpacing = theme.spacing(2);

  return {
    wrapper: css`
      width: 100%;
      height: 100%;
      position: fixed;
      z-index: ${theme.zIndex.sidemenu};
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: ${theme.colors.background.canvas};
      display: flex;
      flex-direction: column;
    `,
    verticalSplitPanesWrapper: css`
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      position: relative;
    `,
    mainPaneWrapper: css`
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      padding-right: ${uiState.isPanelOptionsVisible ? 0 : paneSpacing};
    `,
    variablesWrapper: css`
      label: variablesWrapper;
      display: flex;
      flex-grow: 1;
      flex-wrap: wrap;
      gap: ${theme.spacing(1, 2)};
    `,
    panelWrapper: css`
      flex: 1 1 0;
      min-height: 0;
      width: 100%;
      padding-left: ${paneSpacing};
    `,
    tabsWrapper: css`
      height: 100%;
      width: 100%;
    `,
    panelToolbar: css`
      display: flex;
      padding: 0 0 ${paneSpacing} ${paneSpacing};
      justify-content: space-between;
      flex-wrap: wrap;
    `,
    toolbarLeft: css`
      padding-left: ${theme.spacing(1)};
    `,
    centeringContainer: css`
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;
      flex-direction: column;
    `,
  };
});

type EditorStyles = ReturnType<typeof getStyles>;
