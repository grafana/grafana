import React, { PureComponent, CSSProperties } from 'react';
import {
  GrafanaTheme,
  FieldConfigSource,
  PanelData,
  LoadingState,
  DefaultTimeRange,
  PanelEvents,
  SelectableValue,
} from '@grafana/data';
import { stylesFactory, Forms, FieldConfigEditor, CustomScrollbar, selectThemeVariant } from '@grafana/ui';
import { css, cx } from 'emotion';
import config from 'app/core/config';
import AutoSizer from 'react-virtualized-auto-sizer';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT } from 'app/core/constants';

import { PanelModel } from '../../state/PanelModel';
import { DashboardModel } from '../../state/DashboardModel';
import { DashboardPanel } from '../../dashgrid/DashboardPanel';

import SplitPane from 'react-split-pane';
import { StoreState } from '../../../../types/store';
import { connect } from 'react-redux';
import { updateLocation } from '../../../../core/reducers/location';
import { Unsubscribable } from 'rxjs';
import { PanelTitle } from './PanelTitle';
import { DisplayMode, displayModes } from './types';
import { PanelEditorTabs } from './PanelEditorTabs';

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

interface Props {
  dashboard: DashboardModel;
  sourcePanel: PanelModel;
  updateLocation: typeof updateLocation;
}

interface State {
  pluginLoadedCounter: number;
  panel: PanelModel;
  data: PanelData;
  mode: DisplayMode;
  showPanelOptions: boolean;
}

export class PanelEditor extends PureComponent<Props, State> {
  querySubscription: Unsubscribable;

  constructor(props: Props) {
    super(props);

    // To ensure visualisation  settings are re-rendered when plugin has loaded
    // panelInitialised event is emmited from PanelChrome
    const panel = props.sourcePanel.getEditClone();
    this.state = {
      panel,
      pluginLoadedCounter: 0,
      mode: DisplayMode.Fill,
      showPanelOptions: true,
      data: {
        state: LoadingState.NotStarted,
        series: [],
        timeRange: DefaultTimeRange,
      },
    };
  }

  componentDidMount() {
    const { sourcePanel } = this.props;
    const { panel } = this.state;
    panel.events.on(PanelEvents.panelInitialized, () => {
      this.setState(state => ({
        pluginLoadedCounter: state.pluginLoadedCounter + 1,
      }));
    });
    // Get data from any pending
    sourcePanel
      .getQueryRunner()
      .getData()
      .subscribe({
        next: (data: PanelData) => {
          this.setState({ data });
          // TODO, cancel????
        },
      });

    // Listen for queries on the new panel
    const queryRunner = panel.getQueryRunner();
    this.querySubscription = queryRunner.getData().subscribe({
      next: (data: PanelData) => this.setState({ data }),
    });
  }

  componentWillUnmount() {
    if (this.querySubscription) {
      this.querySubscription.unsubscribe();
    }
    //this.cleanUpAngularOptions();
  }

  onPanelUpdate = () => {
    const { panel } = this.state;
    const { dashboard } = this.props;
    dashboard.updatePanel(panel);
  };

  onPanelExit = () => {
    const { updateLocation } = this.props;
    this.onPanelUpdate();
    updateLocation({
      query: { editPanel: null },
      partial: true,
    });
  };

  onDiscard = () => {
    this.props.updateLocation({
      query: { editPanel: null },
      partial: true,
    });
  };

  onFieldConfigsChange = (fieldOptions: FieldConfigSource) => {
    // NOTE: for now, assume this is from 'fieldOptions' -- TODO? put on panel model directly?
    const { panel } = this.state;
    const options = panel.getOptions();
    panel.updateOptions({
      ...options,
      fieldOptions, // Assume it is from shared singlestat -- TODO own property?
    });
    this.forceUpdate();
  };

  renderFieldOptions() {
    const { panel, data } = this.state;
    const { plugin } = panel;
    const fieldOptions = panel.options['fieldOptions'] as FieldConfigSource;
    if (!fieldOptions || !plugin) {
      return null;
    }

    return (
      <div>
        <FieldConfigEditor
          config={fieldOptions}
          custom={plugin.customFieldConfigs}
          onChange={this.onFieldConfigsChange}
          data={data.series}
        />
      </div>
    );
  }

  onPanelOptionsChanged = (options: any) => {
    this.state.panel.updateOptions(options);
    this.forceUpdate();
  };

  /**
   * The existing visualization tab
   */
  renderVisSettings() {
    const { data, panel } = this.state;
    const { plugin } = panel;
    if (!plugin) {
      return null; // not yet ready
    }

    if (plugin.editor && panel) {
      return (
        <div style={{ marginTop: '40px' }}>
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
    this.state.panel.title = title;
    this.forceUpdate();
  };

  onDiplayModeChange = (mode: SelectableValue<DisplayMode>) => {
    this.setState({
      mode: mode.value!,
    });
  };

  onTogglePanelOptions = () => {
    this.setState({
      showPanelOptions: !this.state.showPanelOptions,
    });
  };

  renderHorizontalSplit(styles: any) {
    const { dashboard } = this.props;
    const { panel, mode } = this.state;

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
    const { panel, mode, showPanelOptions } = this.state;
    const styles = getStyles(config.theme);

    if (!panel) {
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
          </div>
        </div>
        <div className={styles.panes}>
          {showPanelOptions ? (
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
                    {this.renderVisSettings()}
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

function calculatePanelSize(mode: DisplayMode, width: number, height: number, panel: PanelModel): CSSProperties {
  if (mode === DisplayMode.Fill) {
    return { width, height };
  }
  const colWidth = (window.innerWidth - GRID_CELL_VMARGIN * 4) / GRID_COLUMN_COUNT;
  const pWidth = colWidth * panel.gridPos.w;
  const pHeight = GRID_CELL_HEIGHT * panel.gridPos.h;
  const scale = Math.min(width / pWidth, height / pHeight);

  if (mode === DisplayMode.Exact && pWidth <= width && pHeight <= height) {
    return {
      width: pWidth,
      height: pHeight,
    };
  }

  return {
    width: pWidth * scale,
    height: pHeight * scale,
  };
}

const mapStateToProps = (state: StoreState) => ({
  location: state.location,
});

const mapDispatchToProps = {
  updateLocation,
};

export default connect(mapStateToProps, mapDispatchToProps)(PanelEditor);
