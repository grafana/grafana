import React, { PureComponent } from 'react';
import { FieldConfigSource, GrafanaTheme, PanelData, PanelPlugin, SelectableValue } from '@grafana/data';
import { CustomScrollbar, Forms, selectThemeVariant, stylesFactory } from '@grafana/ui';
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
import { PanelTitle } from './PanelTitle';
import { DisplayMode, displayModes, PanelEditorTab } from './types';
import { PanelEditorTabs } from './PanelEditorTabs';
import { DashNavTimeControls } from '../DashNav/DashNavTimeControls';
import { BackButton } from 'app/core/components/BackButton/BackButton';
import { LocationState } from 'app/types';
import { calculatePanelSize } from './utils';
import { initPanelEditor, panelEditorCleanUp, updatePanelEditorUIState } from './state/actions';
import { PanelEditorUIState, setDiscardChanges } from './state/reducers';
import { FieldConfigEditor } from './FieldConfigEditor';
import { OptionsGroup } from './OptionsGroup';
import { getPanelEditorTabs } from './state/selectors';
import { getPanelStateById } from '../../state/selectors';

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
}

interface DispatchProps {
  updateLocation: typeof updateLocation;
  initPanelEditor: typeof initPanelEditor;
  panelEditorCleanUp: typeof panelEditorCleanUp;
  setDiscardChanges: typeof setDiscardChanges;
  updatePanelEditorUIState: typeof updatePanelEditorUIState;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

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

  onFieldConfigsChange = (fieldOptions: FieldConfigSource) => {
    // NOTE: for now, assume this is from 'fieldOptions' -- TODO? put on panel model directly?
    const { panel } = this.props;
    const options = panel.getOptions();
    panel.updateOptions({
      ...options,
      fieldOptions, // Assume it is from shared singlestat -- TODO own property?
    });
    this.forceUpdate();
  };

  renderFieldOptions() {
    const { plugin, panel, data } = this.props;

    const fieldOptions = panel.options['fieldOptions'] as FieldConfigSource;

    if (!fieldOptions || !plugin) {
      return null;
    }

    return (
      <FieldConfigEditor
        config={fieldOptions}
        plugin={plugin}
        onChange={this.onFieldConfigsChange}
        data={data.series}
      />
    );
  }

  onPanelOptionsChanged = (options: any) => {
    this.props.panel.updateOptions(options);
    this.forceUpdate();
  };

  /**
   * The existing visualization tab
   */
  renderVisSettings() {
    const { data, panel } = this.props;
    const { plugin } = this.props;

    if (!plugin) {
      return null;
    }

    if (plugin.editor && panel) {
      return (
        <div style={{ marginTop: '10px' }}>
          <plugin.editor data={data} options={panel.getOptions()} onOptionsChange={this.onPanelOptionsChanged} />
        </div>
      );
    }

    return <div>No editor (angular?)</div>;
  }

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

  renderHorizontalSplit(styles: any) {
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
        <div className={styles.noScrollPaneContent}>
          <PanelEditorTabs panel={panel} dashboard={dashboard} tabs={tabs} onChangeTab={this.onChangeTab} data={data} />
        </div>
      </SplitPane>
    );
  }

  render() {
    const { dashboard, location, panel, uiState, initDone } = this.props;
    const styles = getStyles(config.theme);

    if (!initDone) {
      return null;
    }

    return (
      <div className={styles.wrapper}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <BackButton onClick={this.onPanelExit} />
            <PanelTitle value={panel.title} onChange={this.onPanelTitleChange} />
          </div>
          <div className={styles.toolbarLeft}>
            <div className={styles.toolbarItem}>
              <Forms.Button
                className={styles.toolbarItem}
                icon="fa fa-remove"
                variant="destructive"
                onClick={this.onDiscard}
              />
            </div>
            <div className={styles.toolbarItem}>
              <Forms.Select
                value={displayModes.find(v => v.value === uiState.mode)}
                options={displayModes}
                onChange={this.onDiplayModeChange}
              />
            </div>
            <div className={styles.toolbarItem}>
              <Forms.Button
                className={styles.toolbarItem}
                icon="fa fa-sliders"
                variant="secondary"
                onClick={this.onTogglePanelOptions}
              />
            </div>
            <div>
              <DashNavTimeControls dashboard={dashboard} location={location} updateLocation={updateLocation} />
            </div>
          </div>
        </div>
        <div className={styles.editorBody}>
          {uiState.isPanelOptionsVisible ? (
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
              <div className={styles.panelOptionsPane}>
                <CustomScrollbar>
                  {this.renderFieldOptions()}
                  <OptionsGroup title="Old settings">{this.renderVisSettings()}</OptionsGroup>
                </CustomScrollbar>
              </div>
            </SplitPane>
          ) : (
            this.renderHorizontalSplit(styles)
          )}
        </div>
      </div>
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
const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const handleColor = theme.colors.blueLight;
  const background = selectThemeVariant({ light: theme.colors.white, dark: theme.colors.inputBlack }, theme.type);

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
      background: ${background};
      padding: ${theme.spacing.sm};
    `,
    panelWrapper: css`
      width: 100%;
      height: 100%;
    `,
    resizerV: cx(
      resizer,
      css`
        cursor: col-resize;
        width: 8px;
        border-right-width: 1px;
      `
    ),
    resizerH: cx(
      resizer,
      css`
        height: 8px;
        cursor: row-resize;
        position: relative;
        top: 49px;
        z-index: 1;
        border-top-width: 1px;
      `
    ),
    noScrollPaneContent: css`
      height: 100%;
      width: 100%;
    `,
    panelOptionsPane: css`
      height: 100%;
      width: 100%;
      background: ${theme.colors.pageBg};
      border: 1px solid ${theme.colors.pageHeaderBorder};
      border-bottom: none;
    `,
    toolbar: css`
      display: flex;
      padding-bottom: ${theme.spacing.sm};
      justify-content: space-between;
    `,
    editorBody: css`
      height: calc(100% - 55px);
      position: relative;
    `,
    toolbarLeft: css`
      padding-left: ${theme.spacing.sm};
      display: flex;
      align-items: center;
    `,
    toolbarItem: css`
      margin-right: ${theme.spacing.sm};
    `,
    centeringContainer: css`
      display: flex;
      justify-content: center;
      align-items: center;
    `,
  };
});
