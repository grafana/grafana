import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Subscription } from 'rxjs';

import { FieldConfigSource, GrafanaTheme2, NavModel, NavModelItem, PageLayoutType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, locationService } from '@grafana/runtime';
import {
  Button,
  HorizontalGroup,
  InlineSwitch,
  ModalsController,
  PageToolbar,
  RadioButtonGroup,
  Stack,
  stylesFactory,
  Themeable2,
  ToolbarButton,
  ToolbarButtonRow,
  withTheme2,
} from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { Page } from 'app/core/components/Page/Page';
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
  sectionNav: NavModel;
  pageNav: NavModelItem;
  className?: string;
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
          <Stack gap={1}>
            <InlineSwitch
              label="Table view"
              showLabel={true}
              id="table-view"
              value={tableViewEnabled}
              onClick={this.onToggleTableView}
              aria-label={selectors.components.PanelEditor.toggleTableView}
            />
            <RadioButtonGroup value={uiState.mode} options={displayModes} onChange={this.onDisplayModeChange} />
            <DashNavTimeControls dashboard={dashboard} onChangeTimeZone={updateTimeZoneForSession} isOnCanvas={true} />
            {!uiState.isPanelOptionsVisible && <VisualizationButton panel={panel} />}
          </Stack>
        </HorizontalGroup>
      </div>
    );
  }

  renderEditorActions() {
    const size = config.featureToggles.topnav ? 'sm' : 'md';
    let editorActions = [
      <Button
        onClick={this.onDiscard}
        title="Undo all changes"
        key="discard"
        size={size}
        variant="destructive"
        fill="outline"
      >
        Discard
      </Button>,
      this.props.panel.libraryPanel ? (
        <Button
          onClick={this.onSaveLibraryPanel}
          variant="primary"
          size={size}
          title="Apply changes and save library panel"
          key="save-panel"
        >
          Save library panel
        </Button>
      ) : (
        <Button
          onClick={this.onSaveDashboard}
          title="Apply changes and save dashboard"
          key="save"
          size={size}
          variant="secondary"
        >
          Save
        </Button>
      ),
      <Button
        onClick={this.onBack}
        variant="primary"
        title="Apply changes and go back to dashboard"
        data-testid={selectors.components.PanelEditor.applyButton}
        key="apply"
        size={size}
      >
        Apply
      </Button>,
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

  renderToolbar() {
    if (config.featureToggles.topnav) {
      return (
        <AppChromeUpdate
          actions={<ToolbarButtonRow alignment="right">{this.renderEditorActions()}</ToolbarButtonRow>}
        />
      );
    }

    return (
      <PageToolbar title={this.props.dashboard.title} section="Edit Panel" onGoBack={this.onGoBackToDashboard}>
        {this.renderEditorActions()}
      </PageToolbar>
    );
  }

  render() {
    const { initDone, updatePanelEditorUIState, uiState, theme, sectionNav, pageNav, className } = this.props;
    const styles = getStyles(theme, this.props);

    if (!initDone) {
      return null;
    }

    return (
      <Page
        navModel={sectionNav}
        pageNav={pageNav}
        aria-label={selectors.components.PanelEditor.General.content}
        layout={PageLayoutType.Custom}
        toolbar={this.renderToolbar()}
        className={className}
      >
        <div className={styles.wrapper}>
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
      </Page>
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
    wrapper: css({
      width: '100%',
      flexGrow: 1,
      minHeight: 0,
      display: 'flex',
      paddingTop: config.featureToggles.topnav ? theme.spacing(2) : 0,
    }),
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
