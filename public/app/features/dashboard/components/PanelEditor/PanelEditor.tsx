import React, { PureComponent } from 'react';
import { FieldConfigSource, GrafanaTheme, PanelData, PanelPlugin, SelectableValue } from '@grafana/data';
import { Select, stylesFactory, Icon } from '@grafana/ui';
import { css, cx } from 'emotion';
import config from 'app/core/config';
import AutoSizer from 'react-virtualized-auto-sizer';

import { PanelModel } from '../../state/PanelModel';
import { DashboardModel } from '../../state/DashboardModel';
import { DashboardPanel } from '../../dashgrid/DashboardPanel';

import SplitPane from 'react-split-pane';
import { StoreState } from '../../../../types/store';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { updateLocation } from '../../../../core/reducers/location';
import { Unsubscribable } from 'rxjs';
import { DisplayMode, displayModes, PanelEditorTab } from './types';
import { PanelEditorTabs } from './PanelEditorTabs';
import { DashNavTimeControls } from '../DashNav/DashNavTimeControls';
import { BackButton } from 'app/core/components/BackButton/BackButton';
import { LocationState } from 'app/types';
import { calculatePanelSize } from './utils';
import { initPanelEditor, panelEditorCleanUp, updatePanelEditorUIState } from './state/actions';
import { PanelEditorUIState, setDiscardChanges } from './state/reducers';
import { getPanelEditorTabs } from './state/selectors';
import { getPanelStateById } from '../../state/selectors';
import { OptionsPaneContent } from './OptionsPaneContent';
import { DashNavButton } from 'app/features/dashboard/components/DashNav/DashNavButton';
import { VariableModel } from 'app/features/templating/types';
import { getVariables } from 'app/features/variables/state/selectors';
import { SubMenuItems } from 'app/features/dashboard/components/SubMenu/SubMenuItems';

enum Pane {
  Right,
  Top,
}

interface OwnProps {
  dashboard: DashboardModel;
  sourcePanel: PanelModel;
}

interface ConnectedProps {
  location: LocationState;
  plugin?: PanelPlugin;
  panel: PanelModel;
  data: PanelData;
  initDone: boolean;
  tabs: PanelEditorTab[];
  uiState: PanelEditorUIState;
  variables: VariableModel[];
}

interface DispatchProps {
  updateLocation: typeof updateLocation;
  initPanelEditor: typeof initPanelEditor;
  panelEditorCleanUp: typeof panelEditorCleanUp;
  setDiscardChanges: typeof setDiscardChanges;
  updatePanelEditorUIState: typeof updatePanelEditorUIState;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

// TODO[NewPanelEdit]: Remove when we switch to new panel editor
export const NewPanelEditorContext = React.createContext(false);

export class PanelEditorUnconnected extends PureComponent<Props> {
  querySubscription: Unsubscribable;

  componentDidMount() {
    this.props.initPanelEditor(this.props.sourcePanel, this.props.dashboard);
  }

  componentWillUnmount() {
    this.props.panelEditorCleanUp();
  }

  onPanelExit = () => {
    this.props.updateLocation({
      query: { editPanel: null },
      partial: true,
    });
  };

  onDiscard = () => {
    this.props.setDiscardChanges(true);
    this.props.updateLocation({
      query: { editPanel: null },
      partial: true,
    });
  };

  onChangeTab = (tab: PanelEditorTab) => {
    this.props.updateLocation({ query: { tab: tab.id }, partial: true });
  };

  onFieldConfigChange = (config: FieldConfigSource) => {
    const { panel } = this.props;

    panel.updateFieldConfig({
      ...config,
    });
    this.forceUpdate();
  };

  onPanelOptionsChanged = (options: any) => {
    this.props.panel.updateOptions(options);
    this.forceUpdate();
  };

  onPanelConfigChanged = (configKey: string, value: any) => {
    // @ts-ignore
    this.props.panel[configKey] = value;
    this.props.panel.render();
    this.forceUpdate();
  };

  onDragFinished = (pane: Pane, size: number) => {
    document.body.style.cursor = 'auto';
    const targetPane = pane === Pane.Top ? 'topPaneSize' : 'rightPaneSize';
    const { updatePanelEditorUIState } = this.props;
    updatePanelEditorUIState({
      [targetPane]: size,
    });
  };

  onDragStarted = () => {
    document.body.style.cursor = 'row-resize';
  };

  onPanelTitleChange = (title: string) => {
    this.props.panel.title = title;
    this.forceUpdate();
  };

  onDiplayModeChange = (mode: SelectableValue<DisplayMode>) => {
    const { updatePanelEditorUIState } = this.props;
    updatePanelEditorUIState({
      mode: mode.value,
    });
  };

  onTogglePanelOptions = () => {
    const { uiState, updatePanelEditorUIState } = this.props;
    updatePanelEditorUIState({ isPanelOptionsVisible: !uiState.isPanelOptionsVisible });
  };

  renderHorizontalSplit(styles: EditorStyles) {
    const { dashboard, panel, tabs, data, uiState } = this.props;

    return (
      <SplitPane
        split="horizontal"
        minSize={50}
        primary="first"
        /* Use persisted state for default size */
        defaultSize={uiState.topPaneSize}
        pane2Style={{ minHeight: 0 }}
        resizerClassName={styles.resizerH}
        onDragStarted={this.onDragStarted}
        onDragFinished={size => this.onDragFinished(Pane.Top, size)}
      >
        <div className={styles.mainPaneWrapper}>
          {this.renderToolbar(styles)}
          {this.renderTemplateVariables(styles)}
          <div className={styles.panelWrapper}>
            <AutoSizer>
              {({ width, height }) => {
                if (width < 3 || height < 3) {
                  return null;
                }
                return (
                  <div className={styles.centeringContainer} style={{ width, height }}>
                    <div style={calculatePanelSize(uiState.mode, width, height, panel)}>
                      <DashboardPanel
                        dashboard={dashboard}
                        panel={panel}
                        isEditing={false}
                        isInEditMode
                        isFullscreen={false}
                        isInView={true}
                      />
                    </div>
                  </div>
                );
              }}
            </AutoSizer>
          </div>
        </div>
        <div className={styles.tabsWrapper}>
          <PanelEditorTabs panel={panel} dashboard={dashboard} tabs={tabs} onChangeTab={this.onChangeTab} data={data} />
        </div>
      </SplitPane>
    );
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

  renderToolbar(styles: EditorStyles) {
    const { dashboard, location, uiState } = this.props;

    return (
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <BackButton onClick={this.onPanelExit} />
          <span className={styles.editorTitle}>{dashboard.title} / Edit Panel</span>
        </div>
        <div className={styles.toolbarLeft}>
          <div className={styles.toolbarItem}>
            <DashNavButton tooltip="Discard all changes and return to dashboard" onClick={this.onDiscard}>
              Discard changes
            </DashNavButton>
          </div>
          <div className={styles.toolbarItem}>
            <Select
              value={displayModes.find(v => v.value === uiState.mode)}
              options={displayModes}
              onChange={this.onDiplayModeChange}
            />
          </div>
          <div className={styles.toolbarItem}>
            <DashNavTimeControls dashboard={dashboard} location={location} updateLocation={updateLocation} />
          </div>
          {!uiState.isPanelOptionsVisible && (
            <div className={styles.toolbarItem}>
              <DashNavButton
                onClick={this.onTogglePanelOptions}
                tooltip="Open options pane"
                classSuffix="close-options"
              >
                <Icon name="chevron-left" /> <span style={{ paddingLeft: '6px' }}>Show options</span>
              </DashNavButton>
            </div>
          )}
        </div>
      </div>
    );
  }

  renderOptionsPane() {
    const { plugin, dashboard, data, panel } = this.props;

    if (!plugin) {
      return <div />;
    }

    return (
      <OptionsPaneContent
        plugin={plugin}
        dashboard={dashboard}
        data={data}
        panel={panel}
        onClose={this.onTogglePanelOptions}
        onFieldConfigsChange={this.onFieldConfigChange}
        onPanelOptionsChanged={this.onPanelOptionsChanged}
        onPanelConfigChange={this.onPanelConfigChanged}
      />
    );
  }

  renderWithOptionsPane(styles: EditorStyles) {
    const { uiState } = this.props;

    return (
      <SplitPane
        split="vertical"
        minSize={100}
        primary="second"
        /* Use persisted state for default size */
        defaultSize={uiState.rightPaneSize}
        resizerClassName={styles.resizerV}
        onDragStarted={() => (document.body.style.cursor = 'col-resize')}
        onDragFinished={size => this.onDragFinished(Pane.Right, size)}
      >
        {this.renderHorizontalSplit(styles)}
        {this.renderOptionsPane()}
      </SplitPane>
    );
  }

  render() {
    const { initDone, uiState } = this.props;
    const styles = getStyles(config.theme, this.props);

    if (!initDone) {
      return null;
    }

    return (
      <NewPanelEditorContext.Provider value={true}>
        <div className={styles.wrapper}>
          {uiState.isPanelOptionsVisible ? this.renderWithOptionsPane(styles) : this.renderHorizontalSplit(styles)}
        </div>
      </NewPanelEditorContext.Provider>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state, props) => {
  const panel = state.panelEditorNew.getPanel();
  const { plugin } = getPanelStateById(state.dashboard, panel.id);

  return {
    location: state.location,
    plugin: plugin,
    panel: state.panelEditorNew.getPanel(),
    data: state.panelEditorNew.getData(),
    initDone: state.panelEditorNew.initDone,
    tabs: getPanelEditorTabs(state.location, plugin),
    uiState: state.panelEditorNew.ui,
    variables: getVariables(state),
  };
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  updateLocation,
  initPanelEditor,
  panelEditorCleanUp,
  setDiscardChanges,
  updatePanelEditorUIState,
};

export const PanelEditor = connect(mapStateToProps, mapDispatchToProps)(PanelEditorUnconnected);

/*
 * Styles
 */
const getStyles = stylesFactory((theme: GrafanaTheme, props: Props) => {
  const { uiState } = props;
  const handleColor = theme.colors.blueLight;
  const paneSpaceing = theme.spacing.md;

  const resizer = css`
    font-style: italic;
    background: transparent;
    border-top: 0;
    border-right: 0;
    border-bottom: 0;
    border-left: 0;
    border-color: transparent;
    border-style: solid;
    transition: 0.2s border-color ease-in-out;

    &:hover {
      border-color: ${handleColor};
    }
  `;

  return {
    wrapper: css`
      width: 100%;
      height: 100%;
      position: fixed;
      z-index: ${theme.zIndex.modal};
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: ${theme.colors.bodyBg};
      display: flex;
      flex-direction: column;
    `,
    mainPaneWrapper: css`
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      padding-right: ${uiState.isPanelOptionsVisible ? 0 : paneSpaceing};
    `,
    variablesWrapper: css`
      padding: 0 ${theme.spacing.sm} ${theme.spacing.sm} ${paneSpaceing};
    `,
    panelWrapper: css`
      flex: 1 1 0;
      min-height: 0;
      width: 100%;
      padding-left: ${paneSpaceing};
    `,
    resizerV: cx(
      resizer,
      css`
        cursor: col-resize;
        width: ${paneSpaceing};
        border-right-width: 1px;
      `
    ),
    resizerH: cx(
      resizer,
      css`
        height: ${paneSpaceing};
        cursor: row-resize;
        position: relative;
        top: 49px;
        z-index: 1;
        border-top-width: 1px;
      `
    ),
    tabsWrapper: css`
      height: 100%;
      width: 100%;
    `,
    toolbar: css`
      display: flex;
      padding: ${theme.spacing.sm};
      padding-right: 0;
      justify-content: space-between;
    `,
    toolbarLeft: css`
      padding-left: ${theme.spacing.sm};
      display: flex;
      align-items: center;
    `,
    toolbarItem: css`
      margin-right: ${theme.spacing.sm};

      &:last-child {
        margin-right: 0;
      }
    `,
    centeringContainer: css`
      display: flex;
      justify-content: center;
      align-items: center;
    `,
    editorTitle: css`
      font-size: ${theme.typography.size.lg};
      padding-left: ${theme.spacing.md};
    `,
  };
});

type EditorStyles = ReturnType<typeof getStyles>;
