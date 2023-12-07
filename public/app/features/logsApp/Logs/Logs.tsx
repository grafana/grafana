import { css, cx } from '@emotion/css';
import memoizeOne from 'memoize-one';
import React, { createRef, PureComponent } from 'react';

import {
  AbsoluteTimeRange,
  CoreApp,
  DataFrame,
  DataHoverClearEvent,
  DataHoverEvent,
  DataQueryResponse,
  DataSourceApi,
  EventBus,
  ExploreLogsPanelState,
  ExplorePanelsState,
  Field,
  GrafanaTheme2,
  LinkModel,
  LoadingState,
  LogRowContextOptions,
  LogRowModel,
  LogsDedupStrategy,
  LogsMetaItem,
  LogsSortOrder,
  rangeUtil,
  RawTimeRange,
  serializeStateToUrlParam,
  SplitOpen,
  SupplementaryQueryType,
  TimeRange,
  TimeZone,
  urlUtil,
} from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Button, Icon, PanelChrome, RadioButtonGroup, Themeable2, withTheme2 } from '@grafana/ui';
import { SplitPaneWrapper } from 'app/core/components/SplitPaneWrapper/SplitPaneWrapper';
import store from 'app/core/store';
import { createAndCopyShortLink } from 'app/core/utils/shortLinks';
import { InfiniteScroll } from 'app/features/logs/components/InfiniteScroll';
import { getLogRowStyles } from 'app/features/logs/components/getLogRowStyles';
import { dispatch, getState } from 'app/store/store';

import { ExploreItemState } from '../../../types';
import { LogRows } from '../../logs/components/LogRows';
import { LogRowContextModal } from '../../logs/components/log-context/LogRowContextModal';
import { dedupLogRows, filterLogLevels } from '../../logs/logsModel';
import { getUrlStateFromPaneState } from '../hooks/useStateSync';
import { changePanelState } from '../state/explorePane';

import { LogDetails } from './LogDetails';
import { LogResolutionPicker } from './LogResolutionPicker';
import { LogStats } from './LogStats';
import { LogsOptions } from './LogsOptions';
import { LogsOrder } from './LogsOrder';
import { getLogsTableHeight, LogsTableWrap } from './LogsTableWrap';
import { LogsVolumePanelList } from './LogsVolumePanelList';
import { SETTINGS_KEYS } from './utils/logs';

interface Props extends Themeable2 {
  width: number;
  splitOpen: SplitOpen;
  logRows: LogRowModel[];
  logsMeta?: LogsMetaItem[];
  logsSeries?: DataFrame[];
  logsQueries?: DataQuery[];
  visibleRange?: AbsoluteTimeRange;
  theme: GrafanaTheme2;
  loading: boolean;
  loadingState: LoadingState;
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  scanning?: boolean;
  scanRange?: RawTimeRange;
  exploreId: string;
  datasourceType?: string;
  logsVolumeEnabled: boolean;
  logsVolumeData: DataQueryResponse | undefined;
  logsCountEnabled: boolean;
  logsCountData: DataQueryResponse | undefined;
  logsCountWithGroupByData: DataQueryResponse | undefined;
  logsVolumeWithGroupByData: DataQueryResponse | undefined;
  onSetLogsVolumeEnabled: (enabled: boolean) => void;
  loadLogsVolumeData: (suppQueryType?: SupplementaryQueryType) => void;
  showContextToggle?: (row: LogRowModel) => boolean;
  onChangeTime: (range: AbsoluteTimeRange) => void;
  onClickFilterLabel?: (key: string, value: string, frame?: DataFrame) => void;
  onClickFilterOutLabel?: (key: string, value: string, frame?: DataFrame) => void;
  onStartScanning?: () => void;
  onStopScanning?: () => void;
  getRowContext?: (row: LogRowModel, origRow: LogRowModel, options: LogRowContextOptions) => Promise<any>;
  getRowContextQuery?: (row: LogRowModel, options?: LogRowContextOptions) => Promise<DataQuery | null>;
  getLogRowContextUi?: (row: LogRowModel, runContextQuery?: () => void) => React.ReactNode;
  getFieldLinks: (field: Field, rowIndex: number, dataFrame: DataFrame) => Array<LinkModel<Field>>;
  addResultsToCache: () => void;
  clearCache: () => void;
  eventBus: EventBus;
  panelState?: ExplorePanelsState;
  scrollElement?: HTMLDivElement;
  isFilterLabelActive?: (key: string, value: string, refId?: string) => Promise<boolean>;
  logsFrames?: DataFrame[];
  range: TimeRange;
  onClickFilterValue?: (value: string, refId?: string) => void;
  onClickFilterOutValue?: (value: string, refId?: string) => void;
  loadMoreLogs?(range: AbsoluteTimeRange): void;
  datasourceInstance: DataSourceApi<DataQuery>;
}

export type LogsVisualisationType = 'table' | 'logs';

interface State {
  showLabels: boolean;
  showTime: boolean;
  wrapLogMessage: boolean;
  prettifyLogMessage: boolean;
  dedupStrategy: LogsDedupStrategy;
  hiddenLogLevels: string[];
  logsSortOrder: LogsSortOrder;
  isFlipping: boolean;
  displayedFields: string[];
  forceEscape: boolean;
  contextOpen: boolean;
  contextRow?: LogRowModel;
  tableFrame?: DataFrame;
  visualisationType?: LogsVisualisationType;
  logsContainer?: HTMLDivElement;
  logDetailsRow: LogRowModel | undefined;
  groupByLabel?: string;
  paneSize: number;
  sidebarVisible: boolean;
  highlightSearchwords: boolean;
  similaritySetting?: { row: LogRowModel; type: 'show' | 'hide' };
  resolution: number;
}

const DETAILS_SIZE = 410;
const WINDOW_MARGINS = 60;
const INITIAL_PANE_SIZE = (window.innerWidth / 4) * 3;
function getMaxPaneSize() {
  return window.innerWidth - DETAILS_SIZE;
}
function getLastSize() {
  return localStorage.getItem('logs.paneSize')
    ? parseInt(`${localStorage.getItem('logs.paneSize')}`, 10)
    : INITIAL_PANE_SIZE;
}

class UnthemedLogs extends PureComponent<Props, State> {
  flipOrderTimer?: number;
  cancelFlippingTimer?: number;
  topLogsRef = createRef<HTMLDivElement>();
  logsVolumeEventBus: EventBus;

  state: State = {
    showLabels: store.getBool(SETTINGS_KEYS.showLabels, false),
    showTime: store.getBool(SETTINGS_KEYS.showTime, true),
    wrapLogMessage: store.getBool(SETTINGS_KEYS.wrapLogMessage, true),
    prettifyLogMessage: store.getBool(SETTINGS_KEYS.prettifyLogMessage, false),
    dedupStrategy: LogsDedupStrategy.none,
    hiddenLogLevels: [],
    logsSortOrder: store.get(SETTINGS_KEYS.logsSortOrder) || LogsSortOrder.Descending,
    isFlipping: false,
    displayedFields: [],
    forceEscape: false,
    contextOpen: false,
    contextRow: undefined,
    tableFrame: undefined,
    visualisationType: this.props.panelState?.logs?.visualisationType ?? 'logs',
    logsContainer: undefined,
    logDetailsRow: undefined,
    groupByLabel: undefined,
    paneSize: localStorage.getItem('logs.sidebar') === 'true' ? getLastSize() : window.innerWidth - WINDOW_MARGINS,
    sidebarVisible: localStorage.getItem('logs.sidebar') === 'true' ? true : false,
    highlightSearchwords: true,
    similaritySetting: undefined,
    resolution: 0,
  };

  constructor(props: Props) {
    super(props);
    this.logsVolumeEventBus = props.eventBus.newScopedBus('logsvolume', { onlyLocal: false });
  }

  componentDidMount() {
    document.addEventListener('keydown', this.handleKeyPress);
  }

  componentWillUnmount() {
    if (this.flipOrderTimer) {
      window.clearTimeout(this.flipOrderTimer);
    }

    if (this.cancelFlippingTimer) {
      window.clearTimeout(this.cancelFlippingTimer);
    }

    // If we're unmounting logs (e.g. switching to another datasource), we need to remove the table specific panel state, otherwise it will persist in the explore url
    if (
      this.props?.panelState?.logs?.columns ||
      this.props?.panelState?.logs?.refId ||
      this.props?.panelState?.logs?.labelFieldName
    ) {
      dispatch(
        changePanelState(this.props.exploreId, 'logs', {
          ...this.props.panelState?.logs,
          columns: undefined,
          visualisationType: this.state.visualisationType,
          labelFieldName: undefined,
          refId: undefined,
        })
      );
    }

    document.removeEventListener('keydown', this.handleKeyPress);
  }

  updatePanelState = (logsPanelState: Partial<ExploreLogsPanelState>) => {
    const state: ExploreItemState | undefined = getState().explore.panes[this.props.exploreId];
    if (state?.panelsState) {
      dispatch(
        changePanelState(this.props.exploreId, 'logs', {
          ...state.panelsState.logs,
          columns: logsPanelState.columns ?? this.props.panelState?.logs?.columns,
          visualisationType: logsPanelState.visualisationType ?? this.state.visualisationType,
          labelFieldName: logsPanelState.labelFieldName,
          refId: logsPanelState.refId ?? this.props.panelState?.logs?.refId,
        })
      );
    }
  };

  componentDidUpdate(prevProps: Readonly<Props>): void {
    if (this.props.loading && !prevProps.loading && this.props.panelState?.logs?.id) {
      // loading stopped, so we need to remove any permalinked log lines
      delete this.props.panelState.logs.id;

      dispatch(
        changePanelState(this.props.exploreId, 'logs', {
          ...this.props.panelState,
        })
      );
    }
    if (this.props.panelState?.logs?.visualisationType !== prevProps.panelState?.logs?.visualisationType) {
      this.setState({
        visualisationType: this.props.panelState?.logs?.visualisationType ?? 'logs',
      });
    }
    if (this.state.logDetailsRow) {
      const included = this.props.logRows.includes(this.state.logDetailsRow);
      if (!included) {
        const found = this.props.logRows.findIndex((row) => row.rowId === this.state.logDetailsRow?.rowId);
        this.setState({
          logDetailsRow: found ? this.props.logRows[found] : undefined,
        });
      }
    }
  }

  onLogRowHover = (row?: LogRowModel) => {
    if (!row) {
      this.props.eventBus.publish(new DataHoverClearEvent());
    } else {
      this.props.eventBus.publish(
        new DataHoverEvent({
          point: {
            time: row.timeEpochMs,
          },
        })
      );
    }
  };

  onLogsContainerRef = (node: HTMLDivElement) => {
    this.setState({ logsContainer: node });
  };

  onChangeLogsSortOrder = () => {
    this.setState({ isFlipping: true });
    // we are using setTimeout here to make sure that disabled button is rendered before the rendering of reordered logs
    this.flipOrderTimer = window.setTimeout(() => {
      this.setState((prevState) => {
        const newSortOrder =
          prevState.logsSortOrder === LogsSortOrder.Descending ? LogsSortOrder.Ascending : LogsSortOrder.Descending;
        store.set(SETTINGS_KEYS.logsSortOrder, newSortOrder);
        return { logsSortOrder: newSortOrder };
      });
    }, 0);
    this.cancelFlippingTimer = window.setTimeout(() => this.setState({ isFlipping: false }), 1000);
  };

  onEscapeNewlines = () => {
    this.setState((prevState) => ({
      forceEscape: !prevState.forceEscape,
    }));
  };

  onChangeVisualisation = (visualisation: LogsVisualisationType) => {
    this.setState(() => ({
      visualisationType: visualisation,
    }));
    const payload = {
      ...this.props.panelState?.logs,
      visualisationType: visualisation,
    };
    this.updatePanelState(payload);

    reportInteraction('grafana_explore_logs_visualisation_changed', {
      newVisualizationType: visualisation,
      datasourceType: this.props.datasourceType ?? 'unknown',
    });
  };

  onChangeDedup = (dedupStrategy: LogsDedupStrategy) => {
    reportInteraction('grafana_explore_logs_deduplication_clicked', {
      deduplicationType: dedupStrategy,
      datasourceType: this.props.datasourceType,
    });
    this.setState({ dedupStrategy });
  };

  onChangeLabels = (value: boolean) => {
    const showLabels = value;
    this.setState({
      showLabels,
    });
    store.set(SETTINGS_KEYS.showLabels, showLabels);
  };

  onChangeTime = (value: boolean) => {
    const showTime = value;
    this.setState({
      showTime,
    });
    store.set(SETTINGS_KEYS.showTime, showTime);
  };

  onChangeWrapLogMessage = (value: boolean) => {
    const wrapLogMessage = value;
    this.setState({
      wrapLogMessage,
    });
    store.set(SETTINGS_KEYS.wrapLogMessage, wrapLogMessage);
  };

  onChangePrettifyLogMessage = (value: boolean) => {
    const prettifyLogMessage = value;
    this.setState({
      prettifyLogMessage,
    });
    store.set(SETTINGS_KEYS.prettifyLogMessage, prettifyLogMessage);
  };

  onChangeHighlightSearchwords = (value: boolean) => {
    const highlightSearchwords = value;
    this.setState({
      highlightSearchwords,
    });
    store.set(SETTINGS_KEYS.highlightSearchwords, highlightSearchwords);
  };

  onToggleLogLevel = (hiddenRawLevels: string[]) => {
    // const hiddenLogLevels = hiddenRawLevels.map((level) => LogLevel[level as LogLevel]);
    this.setState({ hiddenLogLevels: hiddenRawLevels });
  };

  onChangeGroupByLabel = (groupByLabel?: string) => {
    this.setState({ groupByLabel });
  };

  onToggleLogsVolumeCollapse = (collapsed: boolean) => {
    this.props.onSetLogsVolumeEnabled(!collapsed);
    reportInteraction('grafana_explore_logs_histogram_toggle_clicked', {
      datasourceType: this.props.datasourceType,
      type: !collapsed ? 'open' : 'close',
    });
  };

  onClickScan = (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (this.props.onStartScanning) {
      this.props.onStartScanning();
      reportInteraction('grafana_explore_logs_scanning_button_clicked', {
        type: 'start',
        datasourceType: this.props.datasourceType,
      });
    }
  };

  onClickStopScan = (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (this.props.onStopScanning) {
      this.props.onStopScanning();
    }
  };

  showField = (key: string) => {
    const index = this.state.displayedFields.indexOf(key);

    if (index === -1) {
      this.setState((state) => {
        return {
          displayedFields: state.displayedFields.concat(key),
        };
      });
    }
  };

  hideField = (key: string) => {
    const index = this.state.displayedFields.indexOf(key);
    if (index > -1) {
      this.setState((state) => {
        return {
          displayedFields: state.displayedFields.filter((k) => key !== k),
        };
      });
    }
  };

  clearDetectedFields = () => {
    this.setState((state) => {
      return {
        displayedFields: [],
      };
    });
  };

  onCloseContext = () => {
    this.setState({
      contextOpen: false,
      contextRow: undefined,
    });
  };

  onOpenContext = (row: LogRowModel, onClose?: () => void) => {
    // we are setting the `contextOpen` open state and passing it down to the `LogRow` in order to highlight the row when a LogContext is open
    this.setState({
      contextOpen: true,
      contextRow: row,
    });
    this.onCloseContext = () => {
      this.setState({
        contextOpen: false,
        contextRow: undefined,
      });
      onClose?.();
    };
  };

  onPermalinkClick = async (row: LogRowModel) => {
    // this is an extra check, to be sure that we are not
    // creating permalinks for logs without an id-field.
    // normally it should never happen, because we do not
    // display the permalink button in such cases.
    if (row.rowId === undefined) {
      return;
    }

    // get explore state, add log-row-id and make timerange absolute
    const urlState = getUrlStateFromPaneState(getState().explore.panes[this.props.exploreId]!);
    urlState.panelsState = {
      ...this.props.panelState,
      logs: { id: row.uid, visualisationType: this.state.visualisationType ?? 'logs' },
    };
    urlState.range = {
      from: new Date(this.props.absoluteRange.from).toISOString(),
      to: new Date(this.props.absoluteRange.to).toISOString(),
    };

    // append changed urlState to baseUrl
    const serializedState = serializeStateToUrlParam(urlState);
    const baseUrl = /.*(?=\/logs)/.exec(`${window.location.href}`)![0];
    const url = urlUtil.renderUrl(`${baseUrl}/logs`, { left: serializedState });
    await createAndCopyShortLink(url);
  };

  scrollIntoView = (element: HTMLElement) => {
    if (config.featureToggles.logsInfiniteScrolling) {
      if (this.state.logsContainer) {
        this.topLogsRef.current?.scrollIntoView();
        this.state.logsContainer.scroll({
          behavior: 'smooth',
          top: this.state.logsContainer.scrollTop + element.getBoundingClientRect().top - window.innerHeight / 2,
        });
      }

      return;
    }
    const { scrollElement } = this.props;

    if (scrollElement) {
      scrollElement.scroll({
        behavior: 'smooth',
        top: scrollElement.scrollTop + element.getBoundingClientRect().top - window.innerHeight / 2,
      });
    }
  };

  checkUnescapedContent = memoizeOne((logRows: LogRowModel[]) => {
    return !!logRows.some((r) => r.hasUnescapedContent);
  });

  dedupRows = memoizeOne((logRows: LogRowModel[], dedupStrategy: LogsDedupStrategy) => {
    const dedupedRows = dedupLogRows(logRows, dedupStrategy);
    const dedupCount = dedupedRows.reduce((sum, row) => (row.duplicates ? sum + row.duplicates : sum), 0);
    return { dedupedRows, dedupCount };
  });

  filterRows = memoizeOne((logRows: LogRowModel[], hiddenLogLevels: string[], groupByLabel?: string) => {
    return filterLogLevels(logRows, new Set(hiddenLogLevels), groupByLabel);
  });

  createNavigationRange = memoizeOne((logRows: LogRowModel[]): { from: number; to: number } | undefined => {
    if (!logRows || logRows.length === 0) {
      return undefined;
    }
    const firstTimeStamp = logRows[0].timeEpochMs;
    const lastTimeStamp = logRows[logRows.length - 1].timeEpochMs;

    if (lastTimeStamp < firstTimeStamp) {
      return { from: lastTimeStamp, to: firstTimeStamp };
    }

    return { from: firstTimeStamp, to: lastTimeStamp };
  });

  scrollToTopLogs = () => {
    if (config.featureToggles.logsInfiniteScrolling) {
      if (this.state.logsContainer) {
        this.state.logsContainer.scroll({
          behavior: 'auto',
          top: 0,
        });
      }
    }
    this.topLogsRef.current?.scrollIntoView();
  };

  showDetails = (row: LogRowModel) => {
    if (row === this.state.logDetailsRow) {
      this.setState({
        logDetailsRow: undefined,
      });
      return;
    }
    this.setState(
      {
        logDetailsRow: row,
        sidebarVisible: true,
      },
      () => {
        this.handlePaneResize(this.state.paneSize);
      }
    );
  };

  handleKeyPress = (e: KeyboardEvent) => {
    if (!this.state.logDetailsRow) {
      return;
    }
    if (!['ArrowDown', 'ArrowUp'].includes(e.key)) {
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();

    const currentIndex = this.props.logRows.indexOf(this.state.logDetailsRow);
    if (currentIndex < 0) {
      this.setState({
        logDetailsRow: undefined,
      });
      return;
    }

    const delta = e.key === 'ArrowDown' ? 1 : -1;

    let newIndex = currentIndex + delta;
    if (newIndex < 0) {
      newIndex = this.props.logRows.length - 1;
    } else if (newIndex >= this.props.logRows.length) {
      newIndex = 0;
    }

    const logDetailsRow = this.props.logRows[newIndex];
    this.setState({
      logDetailsRow,
    });
    document.getElementById(`row-${logDetailsRow.rowId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  };

  handlePaneResize = (size?: number) => {
    if (!size) {
      return;
    }
    const minSize = getMaxPaneSize();
    if (this.state.logDetailsRow && size > minSize) {
      size = minSize;
    }
    this.setState({ paneSize: size });
    localStorage.setItem('logs.paneSize', size.toString());
  };

  toggleSidebar = () => {
    const sidebarVisible = !this.state.sidebarVisible;
    this.setState({ sidebarVisible }, () => {
      localStorage.setItem('logs.sidebar', sidebarVisible.toString());
      if (sidebarVisible) {
        this.handlePaneResize(getMaxPaneSize());
      } else {
        this.handlePaneResize(window.innerWidth - WINDOW_MARGINS);
      }
    });
  };

  onLogsSimilarityChange = (row: LogRowModel, type: 'show' | 'hide') => {
    this.setState({ similaritySetting: { row, type } });
  };

  handleResolutionChange = (resolution: number) => {
    this.setState({
      resolution,
    });
  };

  render() {
    const {
      width,
      splitOpen,
      logRows,
      logsVolumeEnabled,
      logsVolumeData,
      logsCountEnabled,
      logsCountData,
      logsCountWithGroupByData,
      logsVolumeWithGroupByData,
      loadLogsVolumeData,
      loading = false,
      onClickFilterLabel,
      onClickFilterOutLabel,
      timeZone,
      scanning,
      scanRange,
      showContextToggle,
      absoluteRange,
      onChangeTime,
      getFieldLinks,
      theme,
      exploreId,
      getRowContext,
      getLogRowContextUi,
      getRowContextQuery,
      loadMoreLogs,
      logsMeta,
    } = this.props;

    const {
      showLabels,
      showTime,
      wrapLogMessage,
      prettifyLogMessage,
      dedupStrategy,
      hiddenLogLevels,
      logsSortOrder,
      isFlipping,
      displayedFields,
      forceEscape,
      contextOpen,
      contextRow,
      highlightSearchwords,
    } = this.state;

    const tableHeight = getLogsTableHeight();
    const styles = getStyles(theme, wrapLogMessage, tableHeight);
    const logRowStyles = getLogRowStyles(theme);
    const hasData = logRows && logRows.length > 0;

    const filteredLogs = this.filterRows(logRows, hiddenLogLevels, this.state.groupByLabel);
    const { dedupedRows } = this.dedupRows(filteredLogs, dedupStrategy);

    const scanText = scanRange ? `Scanning ${rangeUtil.describeTimeRange(scanRange)}` : 'Scanning...';
    let title =
      logsVolumeData?.data || logsVolumeWithGroupByData?.data
        ? 'Count over time'
        : logsCountData?.data || logsCountWithGroupByData?.data
        ? 'Total count'
        : 'Log metrics';
    title = `${title}${
      this.state.hiddenLogLevels.length > 0 ? ` (filtered based on selected ${this.state.groupByLabel})` : ''
    }`;

    const maxPaneSize = getMaxPaneSize();

    return (
      <>
        {getRowContext && contextRow && (
          <LogRowContextModal
            open={contextOpen}
            row={contextRow}
            onClose={this.onCloseContext}
            getRowContext={(row, options) => getRowContext(row, contextRow, options)}
            getRowContextQuery={getRowContextQuery}
            getLogRowContextUi={getLogRowContextUi}
            logsSortOrder={logsSortOrder}
            timeZone={timeZone}
          />
        )}
        <PanelChrome
          title={title}
          collapsible
          collapsed={!logsVolumeEnabled}
          onToggleCollapse={this.onToggleLogsVolumeCollapse}
          height={210}
          width={width + 16}
        >
          {(w, h) =>
            logsVolumeEnabled || logsCountEnabled ? (
              <LogsVolumePanelList
                absoluteRange={absoluteRange}
                width={w}
                logsVolumeData={logsVolumeData}
                logsCountData={logsCountData}
                logsCountWithGroupByData={logsCountWithGroupByData}
                logsVolumeWithGroupByData={logsVolumeWithGroupByData}
                onUpdateTimeRange={onChangeTime}
                timeZone={timeZone}
                splitOpen={splitOpen}
                onLoadLogsVolume={loadLogsVolumeData}
                onHiddenSeriesChanged={this.onToggleLogLevel}
                onChangeGroupByLabel={this.onChangeGroupByLabel}
                groupByLabel={this.state.groupByLabel}
                eventBus={this.logsVolumeEventBus}
                onClose={() => this.onToggleLogsVolumeCollapse(true)}
                datasourceInstance={this.props.datasourceInstance}
              />
            ) : (
              <></>
            )
          }
        </PanelChrome>
        <PanelChrome hoverHeader={true} loadingState={loading ? LoadingState.Loading : LoadingState.Done}>
          <div className={styles.stickyNavigation}>
            <div className={styles.logsOptions}>
              <div>
                <LogsOptions
                  styles={styles}
                  showTime={showTime}
                  showLabels={showLabels}
                  wrapLogMessage={wrapLogMessage}
                  prettifyLogMessage={prettifyLogMessage}
                  highlightSearchwords={highlightSearchwords}
                  exploreId={exploreId}
                  onChangeTime={this.onChangeTime}
                  onChangeLabels={this.onChangeLabels}
                  onChangeWrapLogMessage={this.onChangeWrapLogMessage}
                  onChangePrettifyLogMessage={this.onChangePrettifyLogMessage}
                  onChangeHighlightSearchwords={this.onChangeHighlightSearchwords}
                />
                {this.state.similaritySetting && (
                  <Button
                    size="md"
                    variant="secondary"
                    onClick={() => this.setState({ similaritySetting: undefined })}
                    style={{ marginLeft: '0.5em' }}
                  >
                    Clear similarity filter
                    <Icon name="multiply" size="md" style={{ marginLeft: '0.5em' }} />
                  </Button>
                )}
              </div>
              <div className={styles.resolutionContainer}>
                <LogResolutionPicker rows={logRows?.length || 0} onResolutionChange={this.handleResolutionChange} />
              </div>
              <div className={styles.optionToggles}>
                {config.featureToggles.logsExploreTableVisualisation && (
                  <div className={styles.visualisationType}>
                    <RadioButtonGroup
                      options={[
                        {
                          label: 'List',
                          value: 'logs',
                          description: 'Show results in logs visualisation',
                        },
                        {
                          label: 'Table',
                          value: 'table',
                          description: 'Show results in table visualisation',
                        },
                      ]}
                      size="md"
                      value={this.state.visualisationType}
                      onChange={this.onChangeVisualisation}
                    />
                  </div>
                )}
                <LogsOrder
                  logsSortOrder={logsSortOrder}
                  isFlipping={isFlipping}
                  onChangeLogsSortOrder={this.onChangeLogsSortOrder}
                  styles={styles}
                />
                <Button
                  aria-label={this.state.sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
                  variant="secondary"
                  size="md"
                  className={styles.sidebarToggle}
                  onClick={this.toggleSidebar}
                >
                  <Icon name={this.state.sidebarVisible ? 'angle-right' : 'angle-left'} size="md" />
                </Button>
              </div>
            </div>
            <div ref={this.topLogsRef} />
          </div>
          <div
            className={cx(styles.logsSection, this.state.visualisationType === 'table' ? styles.logsTable : undefined)}
          >
            <SplitPaneWrapper
              splitOrientation="vertical"
              paneSize={this.state.paneSize}
              parentStyle={{ position: 'relative' }}
              onDragFinished={this.handlePaneResize}
              maxSize={maxPaneSize}
            >
              <div className={styles.logsColumn}>
                {this.state.visualisationType === 'table' && hasData && (
                  <div className={styles.logRows} data-testid="logRowsTable">
                    {/* Width should be full width minus logs navigation and padding */}
                    <LogsTableWrap
                      logsSortOrder={this.state.logsSortOrder}
                      range={this.props.range}
                      splitOpen={this.props.splitOpen}
                      timeZone={timeZone}
                      width={width - 80}
                      logsFrames={this.props.logsFrames ?? []}
                      onClickFilterLabel={onClickFilterLabel}
                      onClickFilterOutLabel={onClickFilterOutLabel}
                      panelState={this.props.panelState?.logs}
                      theme={theme}
                      updatePanelState={this.updatePanelState}
                      datasourceType={this.props.datasourceType}
                    />
                  </div>
                )}
                {this.state.visualisationType === 'logs' && hasData && (
                  <div
                    className={config.featureToggles.logsInfiniteScrolling ? styles.scrollableLogRows : styles.logRows}
                    data-testid="logRows"
                    ref={this.onLogsContainerRef}
                  >
                    <InfiniteScroll
                      loading={loading}
                      loadMoreLogs={loadMoreLogs}
                      range={this.props.range}
                      timeZone={timeZone}
                      rows={logRows}
                      scrollElement={this.state.logsContainer}
                      sortOrder={logsSortOrder}
                    >
                      <LogRows
                        logRows={logRows}
                        deduplicatedRows={dedupedRows}
                        dedupStrategy={dedupStrategy}
                        onClickFilterLabel={onClickFilterLabel}
                        onClickFilterOutLabel={onClickFilterOutLabel}
                        showContextToggle={showContextToggle}
                        showLabels={showLabels}
                        showTime={showTime}
                        enableLogDetails={true}
                        forceEscape={forceEscape}
                        wrapLogMessage={wrapLogMessage}
                        prettifyLogMessage={prettifyLogMessage}
                        timeZone={timeZone}
                        getFieldLinks={getFieldLinks}
                        logsSortOrder={logsSortOrder}
                        displayedFields={displayedFields}
                        onClickShowField={this.showField}
                        onClickHideField={this.hideField}
                        app={CoreApp.Explore}
                        onLogRowHover={this.onLogRowHover}
                        onOpenContext={this.onOpenContext}
                        onPermalinkClick={this.onPermalinkClick}
                        permalinkedRowId={this.props.panelState?.logs?.id}
                        scrollIntoView={this.scrollIntoView}
                        isFilterLabelActive={this.props.isFilterLabelActive}
                        containerRendered={!!this.state.logsContainer}
                        onClickFilterValue={this.props.onClickFilterValue}
                        onClickFilterOutValue={this.props.onClickFilterOutValue}
                        showDetails={this.showDetails}
                        logDetailsRow={this.state.logDetailsRow}
                        highlightSearchwords={highlightSearchwords}
                        noMenu
                        similaritySetting={this.state.similaritySetting}
                        resolution={this.state.resolution}
                      />
                    </InfiniteScroll>
                  </div>
                )}

                {!loading && !hasData && !scanning && (
                  <div className={styles.logRows}>
                    <div className={styles.noData}>
                      No logs found.
                      <Button size="sm" variant="secondary" onClick={this.onClickScan}>
                        Scan for older logs
                      </Button>
                    </div>
                  </div>
                )}
                {scanning && (
                  <div className={styles.logRows}>
                    <div className={styles.noData}>
                      <span>{scanText}</span>
                      <Button size="sm" variant="secondary" onClick={this.onClickStopScan}>
                        Stop scan
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: this.state.sidebarVisible ? '' : 'none' }}>
                {this.state.logDetailsRow ? (
                  <LogDetails
                    showDuplicates={false}
                    getFieldLinks={getFieldLinks}
                    onClickFilterLabel={onClickFilterLabel}
                    onClickFilterOutLabel={onClickFilterOutLabel}
                    onClickShowField={this.showField}
                    onClickHideField={this.hideField}
                    rows={logRows}
                    row={this.state.logDetailsRow}
                    wrapLogMessage={wrapLogMessage}
                    hasError={false}
                    displayedFields={displayedFields}
                    app={CoreApp.Explore}
                    styles={logRowStyles}
                    isFilterLabelActive={this.props.isFilterLabelActive}
                    onOpenContext={this.onOpenContext}
                    onPermalinkClick={this.onPermalinkClick}
                    showContextToggle={showContextToggle}
                    prettifyLogMessage={prettifyLogMessage}
                    onSimilarityChange={this.onLogsSimilarityChange}
                  />
                ) : (
                  <LogStats
                    styles={logRowStyles}
                    rows={logRows}
                    logsMeta={logsMeta}
                    onClickFilterLabel={onClickFilterLabel}
                    onClickFilterOutLabel={onClickFilterOutLabel}
                    resolution={this.state.resolution}
                  />
                )}
              </div>
            </SplitPaneWrapper>
          </div>
        </PanelChrome>
      </>
    );
  }
}

export const Logs = withTheme2(UnthemedLogs);

const getStyles = (theme: GrafanaTheme2, wrapLogMessage: boolean, tableHeight: number) => {
  return {
    resolutionContainer: css({
      paddingTop: theme.spacing(1),
      width: '400px',
      opacity: 0.5,
    }),
    sidebarToggle: css({
      // backgroundColor: 'transparent',
      // border: 'none',
      padding: `0 ${theme.spacing(1)}`,
    }),
    optionToggles: css({
      display: 'flex',
    }),
    logOptionsMenu: css({
      position: 'relative',
      left: theme.spacing(3),
      backgroundColor: theme.colors.background.secondary,
      padding: theme.spacing(1),
      paddingLeft: theme.spacing(0.5),
    }),
    logOptionMenuItem: css({
      display: 'flex',
      justifyContent: 'space-between',
    }),
    logsOptions: css({
      marginBottom: theme.spacing(2),
      display: 'flex',
      justifyContent: 'space-between',
    }),
    logsColumn: css({
      minHeight: '16vh',
    }),
    noData: css({
      '& > *': {
        marginLeft: '0.5em',
      },
    }),
    logOptions: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      flexWrap: 'wrap',
      backgroundColor: theme.colors.background.primary,
      padding: `${theme.spacing(1)} ${theme.spacing(2)}`,
      borderRadius: theme.shape.radius.default,
      margin: `${theme.spacing(0, 0, 1)}`,
      border: `1px solid ${theme.colors.border.medium}`,
    }),
    headerButton: css({
      margin: `${theme.spacing(0.5, 0, 0, 1)}`,
    }),
    horizontalInlineLabel: css({
      '& > label': {
        marginRight: '0',
      },
    }),
    radioButtons: css({
      margin: '0',
    }),
    logsSection: css({}),
    logsTable: css({
      maxHeight: `${tableHeight}px`,
    }),
    scrollableLogRows: css({
      overflowX: 'scroll',
      overflowY: 'visible',
      width: '100%',
      maxHeight: '75vh',
    }),
    logRows: css({
      overflowX: `${wrapLogMessage ? 'unset' : 'scroll'}`,
      overflowY: 'visible',
      width: '100%',
    }),
    visualisationType: css({
      marginRight: theme.spacing(1),
    }),
    visualisationTypeRadio: css({
      margin: `0 0 0 ${theme.spacing(1)}`,
    }),
    stickyNavigation: css({
      overflow: 'visible',
      ...(config.featureToggles.logsInfiniteScrolling && { marginBottom: '0px' }),
    }),
  };
};
