import React, { PureComponent } from 'react';
import { GrafanaTheme, FieldConfigSource, PanelData, PanelPlugin, SelectableValue, TimeRange } from '@grafana/data';
import {
  stylesFactory,
  Forms,
  FieldConfigEditor,
  CustomScrollbar,
  selectThemeVariant,
  ControlledCollapse,
} from '@grafana/ui';
import { css, cx } from 'emotion';
import config from 'app/core/config';
import AutoSizer from 'react-virtualized-auto-sizer';

import { PanelModel } from '../../state/PanelModel';
import { DashboardModel } from '../../state/DashboardModel';
import { DashboardPanel } from '../../dashgrid/DashboardPanel';

import SplitPane from 'react-split-pane';
import { StoreState } from '../../../../types/store';
import { connect, MapStateToProps, MapDispatchToProps } from 'react-redux';
import { updateLocation } from '../../../../core/reducers/location';
import { Unsubscribable } from 'rxjs';
import { PanelTitle } from './PanelTitle';
import { DisplayMode, displayModes } from './types';
import { PanelEditorTabs } from './PanelEditorTabs';
import { DashNavTimeControls } from '../DashNav/DashNavTimeControls';
import { LocationState, CoreEvents } from 'app/types';
import { calculatePanelSize } from './utils';
import { initPanelEditor, panelEditorCleanUp } from './state/actions';
import { setDisplayMode, toggleOptionsView, setDiscardChanges } from './state/reducers';

interface OwnProps {
  dashboard: DashboardModel;
  sourcePanel: PanelModel;
}

interface ConnectedProps {
  location: LocationState;
  plugin?: PanelPlugin;
  panel: PanelModel;
  data: PanelData;
  mode: DisplayMode;
  isPanelOptionsVisible: boolean;
  initDone: boolean;
}

interface DispatchProps {
  updateLocation: typeof updateLocation;
  initPanelEditor: typeof initPanelEditor;
  panelEditorCleanUp: typeof panelEditorCleanUp;
  setDisplayMode: typeof setDisplayMode;
  toggleOptionsView: typeof toggleOptionsView;
  setDiscardChanges: typeof setDiscardChanges;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

export class PanelEditorUnconnected extends PureComponent<Props> {
  querySubscription: Unsubscribable;

  componentDidMount() {
    this.props.initPanelEditor(this.props.sourcePanel);
    this.props.dashboard.on(CoreEvents.timeRangeUpdated, this.onTimeRangeUpdated);
  }

  componentWillUnmount() {
    this.props.panelEditorCleanUp();
    this.props.dashboard.off(CoreEvents.timeRangeUpdated, this.onTimeRangeUpdated);
  }

  onTimeRangeUpdated = (timeRange: TimeRange) => {
    const { panel } = this.props;

    if (panel) {
      panel.refresh();
    }
  };

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
        custom={plugin.customFieldConfigs}
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

  onDragFinished = () => {
    document.body.style.cursor = 'auto';
    console.log('TODO, save splitter settings');
  };

  onPanelTitleChange = (title: string) => {
    this.props.panel.title = title;
    this.forceUpdate();
  };

  onDiplayModeChange = (mode: SelectableValue<DisplayMode>) => {
    this.props.setDisplayMode(mode.value);
  };

  onTogglePanelOptions = () => {
    this.props.toggleOptionsView();
  };

  renderHorizontalSplit(styles: any) {
    const { dashboard, panel, mode } = this.props;

    return (
      <SplitPane
        split="horizontal"
        minSize={50}
        primary="second"
        defaultSize="40%"
        resizerClassName={styles.resizerH}
        onDragStarted={() => (document.body.style.cursor = 'row-resize')}
        onDragFinished={this.onDragFinished}
      >
        <div className={styles.panelWrapper}>
          <AutoSizer>
            {({ width, height }) => {
              if (width < 3 || height < 3) {
                return null;
              }
              return (
                <div className={styles.centeringContainer} style={{ width, height }}>
                  <div style={calculatePanelSize(mode, width, height, panel)}>
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
          <PanelEditorTabs panel={panel} dashboard={dashboard} />
        </div>
      </SplitPane>
    );
  }

  render() {
    const { dashboard, location, panel, mode, isPanelOptionsVisible, initDone } = this.props;
    const styles = getStyles(config.theme);

    if (!initDone) {
      return null;
    }

    return (
      <div className={styles.wrapper}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <button className="navbar-edit__back-btn" onClick={this.onPanelExit}>
              <i className="fa fa-arrow-left"></i>
            </button>
            <PanelTitle value={panel.title} onChange={this.onPanelTitleChange} />
          </div>
          <div className={styles.toolbarLeft}>
            <Forms.Select
              value={displayModes.find(v => v.value === mode)}
              options={displayModes}
              onChange={this.onDiplayModeChange}
            />
            <Forms.Button icon="fa fa-cog" variant="secondary" onClick={this.onTogglePanelOptions} />
            <Forms.Button variant="destructive" onClick={this.onDiscard}>
              Discard
            </Forms.Button>

            <div>
              <DashNavTimeControls dashboard={dashboard} location={location} updateLocation={updateLocation} />
            </div>
          </div>
        </div>
        <div className={styles.panes}>
          {isPanelOptionsVisible ? (
            <SplitPane
              split="vertical"
              minSize={100}
              primary="second"
              defaultSize={350}
              resizerClassName={styles.resizerV}
              onDragStarted={() => (document.body.style.cursor = 'col-resize')}
              onDragFinished={this.onDragFinished}
            >
              {this.renderHorizontalSplit(styles)}
              <div className={styles.noScrollPaneContent}>
                <CustomScrollbar>
                  <div style={{ padding: '10px' }}>
                    {this.renderFieldOptions()}
                    <ControlledCollapse label="Visualization Settings" collapsible>
                      {this.renderVisSettings()}
                    </ControlledCollapse>
                  </div>
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

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state, props) => ({
  location: state.location,
  plugin: state.plugins.panels[props.sourcePanel.type],
  panel: state.panelEditorNew.getPanel(),
  mode: state.panelEditorNew.mode,
  isPanelOptionsVisible: state.panelEditorNew.isPanelOptionsVisible,
  data: state.panelEditorNew.getData(),
  initDone: state.panelEditorNew.initDone,
});

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  updateLocation,
  initPanelEditor,
  panelEditorCleanUp,
  setDisplayMode,
  toggleOptionsView,
  setDiscardChanges,
};

export const PanelEditor = connect(mapStateToProps, mapDispatchToProps)(PanelEditorUnconnected);

/*
 * Styles
 */
const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const handleColor = selectThemeVariant(
    {
      dark: theme.colors.dark9,
      light: theme.colors.gray6,
    },
    theme.type
  );

  const resizer = css`
    padding: 3px;
    font-style: italic;
    background: ${theme.colors.panelBg};
    &:hover {
      background: ${handleColor};
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
      background: ${theme.colors.pageBg};
    `,
    panelWrapper: css`
      width: 100%;
      height: 100%;
    `,
    resizerV: cx(
      resizer,
      css`
        cursor: col-resize;
      `
    ),
    resizerH: cx(
      resizer,
      css`
        cursor: row-resize;
      `
    ),
    noScrollPaneContent: css`
      height: 100%;
      width: 100%;
      overflow: hidden;
    `,
    toolbar: css`
      padding: ${theme.spacing.sm};
      height: 48px;
      display: flex;
      justify-content: space-between;
    `,
    panes: css`
      height: calc(100% - 48px);
      position: relative;
    `,
    toolbarLeft: css`
      display: flex;
      align-items: center;
    `,
    centeringContainer: css`
      display: flex;
      justify-content: center;
      align-items: center;
    `,
  };
});
