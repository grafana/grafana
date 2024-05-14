import { css, cx } from '@emotion/css';
import { capitalize, groupBy } from 'lodash';
import memoizeOne from 'memoize-one';
import React, { useCallback, useEffect, useState } from 'react';

import {
  SplitOpen,
  LogRowModel,
  LogsMetaItem,
  DataFrame,
  DataQuery,
  AbsoluteTimeRange,
  GrafanaTheme2,
  LoadingState,
  TimeZone,
  RawTimeRange,
  DataQueryResponse,
  LogRowContextOptions,
  LinkModel,
  EventBus,
  ExplorePanelsState,
  Field,
  TimeRange,
  LogsDedupStrategy,
  LogsSortOrder,
  LogLevel,
  DataTopic,
  CoreApp,
  LogsDedupDescription,
  rangeUtil,
  ExploreLogsPanelState,
  DataHoverClearEvent,
  DataHoverEvent,
  serializeStateToUrlParam,
  urlUtil,
} from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import {
  Button,
  InlineField,
  InlineFieldRow,
  InlineSwitch,
  PanelChrome,
  RadioButtonGroup,
  Themeable2,
  withTheme2,
} from '@grafana/ui';
import { mapMouseEventToMode } from '@grafana/ui/src/components/VizLegend/utils';
import store from 'app/core/store';
import { createAndCopyShortLink } from 'app/core/utils/shortLinks';
import { InfiniteScroll } from 'app/features/logs/components/InfiniteScroll';
import { LogRows } from 'app/features/logs/components/LogRows';
import { LogRowContextModal } from 'app/features/logs/components/log-context/LogRowContextModal';
import { LogLevelColor, dedupLogRows, filterLogLevels } from 'app/features/logs/logsModel';
import { getLogLevel, getLogLevelFromKey, getLogLevelInfo } from 'app/features/logs/utils';
import { getState } from 'app/store/store';
import { ExploreItemState, useDispatch } from 'app/types';

import { useContentOutlineContext } from '../ContentOutline/ContentOutlineContext';
import { getUrlStateFromPaneState } from '../hooks/useStateSync';
import { changePanelState } from '../state/explorePane';

import { LogsFeedback } from './LogsFeedback';
import { LogsMetaRow } from './LogsMetaRow';
import LogsNavigation from './LogsNavigation';
import { LogsTableWrap, getLogsTableHeight } from './LogsTableWrap';
import { LogsVolumePanelList } from './LogsVolumePanelList';
import { SETTINGS_KEYS, visualisationTypeKey } from './utils/logs';

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
  onSetLogsVolumeEnabled: (enabled: boolean) => void;
  loadLogsVolumeData: () => void;
  showContextToggle?: (row: LogRowModel) => boolean;
  onChangeTime: (range: AbsoluteTimeRange) => void;
  onClickFilterLabel?: (key: string, value: string, frame?: DataFrame) => void;
  onClickFilterOutLabel?: (key: string, value: string, frame?: DataFrame) => void;
  onStartScanning?: () => void;
  onStopScanning?: () => void;
  getRowContext?: (row: LogRowModel, origRow: LogRowModel, options: LogRowContextOptions) => Promise<any>;
  getRowContextQuery?: (
    row: LogRowModel,
    options?: LogRowContextOptions,
    cacheFilters?: boolean
  ) => Promise<DataQuery | null>;
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
}

export type LogsVisualisationType = 'table' | 'logs';

// we need to define the order of these explicitly
const DEDUP_OPTIONS = [
  LogsDedupStrategy.none,
  LogsDedupStrategy.exact,
  LogsDedupStrategy.numbers,
  LogsDedupStrategy.signature,
];

const getDefaultVisualisationType = (): LogsVisualisationType => {
  const visualisationType = store.get(visualisationTypeKey);
  if (visualisationType === 'table') {
    return 'table';
  }
  if (visualisationType === 'logs') {
    return 'logs';
  }
  if (config.featureToggles.logsExploreTableDefaultVisualization) {
    return 'table';
  }
  return 'logs';
};

const UnthemedLogs: React.FunctionComponent<Props> = (props: Props) => {
  const {
    width,
    splitOpen,
    logRows,
    logsMeta,
    logsVolumeEnabled,
    logsVolumeData,
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
    logsQueries,
    clearCache,
    addResultsToCache,
    exploreId,
    getRowContext,
    getLogRowContextUi,
    getRowContextQuery,
    loadMoreLogs,
    panelState,
    eventBus,
  } = props;
  const [showLabels, setShowLabels] = useState<boolean>(store.getBool(SETTINGS_KEYS.showLabels, false));
  const [showTime, setShowTime] = useState<boolean>(store.getBool(SETTINGS_KEYS.showTime, true));
  const [wrapLogMessage, setWrapLogMessage] = useState<boolean>(store.getBool(SETTINGS_KEYS.wrapLogMessage, true));
  const [prettifyLogMessage, setPrettifyLogMessage] = useState<boolean>(
    store.getBool(SETTINGS_KEYS.prettifyLogMessage, false)
  );
  const [dedupStrategy, setDedupStrategy] = useState<LogsDedupStrategy>(LogsDedupStrategy.none);
  const [hiddenLogLevels, setHiddenLogLevels] = useState<LogLevel[]>([]);
  const [logsSortOrder, setLogsSortOrder] = useState<LogsSortOrder>(
    store.get(SETTINGS_KEYS.logsSortOrder) || LogsSortOrder.Descending
  );
  const [isFlipping, setIsFlipping] = useState<boolean>(false);
  const [displayedFields, setDisplayedFields] = useState<string[]>([]);
  const [forceEscape, setForceEscape] = useState<boolean>(false);
  const [contextOpen, setContextOpen] = useState<boolean>(false);
  const [contextRow, setContextRow] = useState<LogRowModel | undefined>(undefined);
  const [visualisationType, setVisualisationType] = useState<LogsVisualisationType | undefined>(
    panelState?.logs?.visualisationType ?? getDefaultVisualisationType()
  );
  const [logsContainer, setLogsContainer] = useState<HTMLDivElement | undefined>(undefined);
  const dispatch = useDispatch();
  const logsVolumeEventBus = eventBus.newScopedBus('logsvolume', { onlyLocal: false });
  const { outlineItems, register, unregisterAllChildren } = useContentOutlineContext() ?? {};
  let flipOrderTimer: number | undefined = undefined;
  let cancelFlippingTimer: number | undefined = undefined;
  // @ts-ignore
  const toggleLegendRef: React.MutableRefObject<(name: string, mode: SeriesVisibilityChangeMode) => void> =
    React.createRef();
  const topLogsRef = React.createRef<HTMLDivElement>();

  const tableHeight = getLogsTableHeight();
  const styles = getStyles(theme, wrapLogMessage, tableHeight);
  const hasData = logRows && logRows.length > 0;
  const scanText = scanRange ? `Scanning ${rangeUtil.describeTimeRange(scanRange)}` : 'Scanning...';

  const registerLogLevelsWithContentOutline = useCallback(() => {
    const levelsArr = Object.keys(LogLevelColor);
    const logVolumeDataFrames = new Set(logsVolumeData?.data);
    // TODO remove this once filtering multiple log volumes is supported
    const logVolData = logsVolumeData?.data.filter(
      (frame: DataFrame) => frame.meta?.dataTopic !== DataTopic.Annotations
    );
    const grouped = groupBy(logVolData, 'meta.custom.datasourceName');
    const numberOfLogVolumes = Object.keys(grouped).length;

    // clean up all current log levels
    const logsParent = outlineItems?.find((item) => item.panelId === 'Logs' && item.level === 'root');
    if (logsParent && unregisterAllChildren) {
      unregisterAllChildren(logsParent.id, 'filter');
    }

    // check if we have dataFrames that return the same level
    const logLevelsArray: Array<{ levelStr: string; logLevel: LogLevel }> = [];
    logVolumeDataFrames.forEach((dataFrame) => {
      const { level } = getLogLevelInfo(dataFrame);
      logLevelsArray.push({ levelStr: level, logLevel: getLogLevel(level) });
    });

    const sortedLLArray = logLevelsArray.sort(
      (a: { levelStr: string; logLevel: LogLevel }, b: { levelStr: string; logLevel: LogLevel }) => {
        return levelsArr.indexOf(a.logLevel.toString()) > levelsArr.indexOf(b.logLevel.toString()) ? 1 : -1;
      }
    );

    const logLevels = new Set(sortedLLArray);

    if (logLevels.size > 1 && logsVolumeEnabled && numberOfLogVolumes === 1) {
      logLevels.forEach((level) => {
        const allLevelsSelected = hiddenLogLevels.length === 0;
        const currentLevelSelected = !hiddenLogLevels.find((hiddenLevel) => hiddenLevel === level.levelStr);
        if (register) {
          register({
            title: level.levelStr,
            icon: 'gf-logs',
            panelId: 'Logs',
            level: 'child',
            type: 'filter',
            highlight: currentLevelSelected && !allLevelsSelected,
            onClick: (e: React.MouseEvent) => {
              toggleLegendRef.current?.(level.levelStr, mapMouseEventToMode(e));
            },
            ref: null,
            color: LogLevelColor[level.logLevel],
          });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logsVolumeData?.data]);

  useEffect(() => {
    return () => {
      if (flipOrderTimer) {
        window.clearTimeout(flipOrderTimer);
      }

      if (cancelFlippingTimer) {
        window.clearTimeout(cancelFlippingTimer);
      }

      // If we're unmounting logs (e.g. switching to another datasource), we need to remove the table specific panel state, otherwise it will persist in the explore url
      if (panelState?.logs?.columns || panelState?.logs?.refId || panelState?.logs?.labelFieldName) {
        dispatch(
          changePanelState(exploreId, 'logs', {
            ...panelState?.logs,
            columns: undefined,
            visualisationType: visualisationType,
            labelFieldName: undefined,
            refId: undefined,
          })
        );
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading && panelState?.logs?.id) {
      // loading stopped, so we need to remove any permalinked log lines
      delete panelState.logs.id;

      dispatch(
        changePanelState(exploreId, 'logs', {
          ...panelState,
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, exploreId, panelState?.logs?.id, loading]);

  useEffect(() => {
    const visualisationType = panelState?.logs?.visualisationType ?? getDefaultVisualisationType();
    setVisualisationType(visualisationType);

    store.set(visualisationTypeKey, visualisationType);
  }, [panelState?.logs?.visualisationType]);

  useEffect(() => {
    console.log('wat', hiddenLogLevels, JSON.stringify(logsVolumeData?.data));
    registerLogLevelsWithContentOutline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logsVolumeData?.data, hiddenLogLevels]);

  const updatePanelState = (logsPanelState: Partial<ExploreLogsPanelState>) => {
    const state: ExploreItemState | undefined = getState().explore.panes[exploreId];
    if (state?.panelsState) {
      dispatch(
        changePanelState(exploreId, 'logs', {
          ...state.panelsState.logs,
          columns: logsPanelState.columns ?? panelState?.logs?.columns,
          visualisationType: logsPanelState.visualisationType ?? visualisationType,
          labelFieldName: logsPanelState.labelFieldName,
          refId: logsPanelState.refId ?? panelState?.logs?.refId,
        })
      );
    }
  };

  // actions
  const onLogRowHover = (row?: LogRowModel) => {
    if (!row) {
      props.eventBus.publish(new DataHoverClearEvent());
    } else {
      props.eventBus.publish(
        new DataHoverEvent({
          point: {
            time: row.timeEpochMs,
          },
        })
      );
    }
  };

  const onLogsContainerRef = (node: HTMLDivElement) => {
    setLogsContainer(node);
  };

  const onChangeLogsSortOrder = () => {
    setIsFlipping(true);
    // we are using setTimeout here to make sure that disabled button is rendered before the rendering of reordered logs
    flipOrderTimer = window.setTimeout(() => {
      const newSortOrder =
        logsSortOrder === LogsSortOrder.Descending ? LogsSortOrder.Ascending : LogsSortOrder.Descending;
      store.set(SETTINGS_KEYS.logsSortOrder, newSortOrder);
      setLogsSortOrder(newSortOrder);
    }, 0);
    cancelFlippingTimer = window.setTimeout(() => setIsFlipping(false), 1000);
  };

  const onEscapeNewlines = () => {
    setForceEscape(!forceEscape);
  };

  const onChangeVisualisation = (visualisation: LogsVisualisationType) => {
    setVisualisationType(visualisation);
    const payload = {
      ...panelState?.logs,
      visualisationType: visualisation,
    };
    updatePanelState(payload);

    reportInteraction('grafana_explore_logs_visualisation_changed', {
      newVisualizationType: visualisation,
      datasourceType: props.datasourceType ?? 'unknown',
      defaultVisualisationType: config.featureToggles.logsExploreTableDefaultVisualization ? 'table' : 'logs',
    });
  };

  const onChangeDedup = (dedupStrategy: LogsDedupStrategy) => {
    reportInteraction('grafana_explore_logs_deduplication_clicked', {
      deduplicationType: dedupStrategy,
      datasourceType: props.datasourceType,
    });
    setDedupStrategy(dedupStrategy);
  };

  const onChangeLabels = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { target } = event;
    if (target) {
      const showLabels = target.checked;

      setShowLabels(showLabels);
      store.set(SETTINGS_KEYS.showLabels, showLabels);
    }
  };

  const onChangeShowTime = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { target } = event;
    if (target) {
      const showTime = target.checked;

      setShowTime(showTime);
      store.set(SETTINGS_KEYS.showTime, showTime);
    }
  };

  const onChangeWrapLogMessage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { target } = event;
    if (target) {
      const wrapLogMessage = target.checked;

      setWrapLogMessage(wrapLogMessage);
      store.set(SETTINGS_KEYS.wrapLogMessage, wrapLogMessage);
    }
  };

  const onChangePrettifyLogMessage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { target } = event;
    if (target) {
      const prettifyLogMessage = target.checked;

      setPrettifyLogMessage(prettifyLogMessage);
      store.set(SETTINGS_KEYS.prettifyLogMessage, prettifyLogMessage);
    }
  };

  const onToggleLogLevel = (hiddenRawLevels: string[]) => {
    const hiddenLogLevels = hiddenRawLevels.map((level) => getLogLevelFromKey(level));
    setHiddenLogLevels(hiddenLogLevels);
  };

  const onToggleLogsVolumeCollapse = (collapsed: boolean) => {
    props.onSetLogsVolumeEnabled(!collapsed);
    reportInteraction('grafana_explore_logs_histogram_toggle_clicked', {
      datasourceType: props.datasourceType,
      type: !collapsed ? 'open' : 'close',
    });
  };

  const onClickScan = (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (props.onStartScanning) {
      props.onStartScanning();
      reportInteraction('grafana_explore_logs_scanning_button_clicked', {
        type: 'start',
        datasourceType: props.datasourceType,
      });
    }
  };

  const onClickStopScan = (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (props.onStopScanning) {
      props.onStopScanning();
    }
  };

  const showField = (key: string) => {
    const index = displayedFields.indexOf(key);

    if (index === -1) {
      setDisplayedFields(displayedFields.concat(key));
    }
  };

  const hideField = (key: string) => {
    const index = displayedFields.indexOf(key);
    if (index > -1) {
      setDisplayedFields(displayedFields.filter((k) => key !== k));
    }
  };

  const clearDetectedFields = () => {
    setDisplayedFields([]);
  };

  let onCloseContext = () => {
    setContextOpen(false);
    setContextRow(undefined);
  };

  const onOpenContext = (row: LogRowModel, onClose: () => void) => {
    // we are setting the `contextOpen` open state and passing it down to the `LogRow` in order to highlight the row when a LogContext is open
    setContextOpen(true);
    setContextRow(row);
    reportInteraction('grafana_explore_logs_log_context_opened', {
      datasourceType: row.datasourceType,
      logRowUid: row.uid,
    });
    onCloseContext = () => {
      setContextOpen(false);
      setContextRow(undefined);
      reportInteraction('grafana_explore_logs_log_context_closed', {
        datasourceType: row.datasourceType,
        logRowUid: row.uid,
      });
      onClose();
    };
  };

  const getPreviousLog = (row: LogRowModel, allLogs: LogRowModel[]) => {
    for (let i = allLogs.indexOf(row) - 1; i >= 0; i--) {
      if (allLogs[i].timeEpochMs > row.timeEpochMs) {
        return allLogs[i];
      }
    }

    return null;
  };

  const getPermalinkRange = (row: LogRowModel) => {
    const range = {
      from: new Date(absoluteRange.from).toISOString(),
      to: new Date(absoluteRange.to).toISOString(),
    };
    if (!config.featureToggles.logsInfiniteScrolling) {
      return range;
    }

    // With infinite scrolling, the time range of the log line can be after the absolute range or beyond the request line limit, so we need to adjust
    // Look for the previous sibling log, and use its timestamp
    const allLogs = logRows.filter((logRow) => logRow.dataFrame.refId === row.dataFrame.refId);
    const prevLog = getPreviousLog(row, allLogs);

    if (row.timeEpochMs > absoluteRange.to && !prevLog) {
      // Because there's no sibling and the current `to` is oldest than the log, we have no reference we can use for the interval
      // This only happens when you scroll into the future and you want to share the first log of the list
      return {
        from: new Date(absoluteRange.from).toISOString(),
        // Slide 1ms otherwise it's very likely to be omitted in the results
        to: new Date(row.timeEpochMs + 1).toISOString(),
      };
    }

    return {
      from: new Date(absoluteRange.from).toISOString(),
      to: new Date(prevLog ? prevLog.timeEpochMs : absoluteRange.to).toISOString(),
    };
  };

  const onPermalinkClick = async (row: LogRowModel) => {
    // this is an extra check, to be sure that we are not
    // creating permalinks for logs without an id-field.
    // normally it should never happen, because we do not
    // display the permalink button in such cases.
    if (row.rowId === undefined) {
      return;
    }

    // get explore state, add log-row-id and make timerange absolute
    const urlState = getUrlStateFromPaneState(getState().explore.panes[exploreId]!);
    urlState.panelsState = {
      ...panelState,
      logs: { id: row.uid, visualisationType: visualisationType ?? getDefaultVisualisationType() },
    };
    urlState.range = getPermalinkRange(row);

    // append changed urlState to baseUrl
    const serializedState = serializeStateToUrlParam(urlState);
    const baseUrl = /.*(?=\/explore)/.exec(`${window.location.href}`)![0];
    const url = urlUtil.renderUrl(`${baseUrl}/explore`, { left: serializedState });
    await createAndCopyShortLink(url);

    reportInteraction('grafana_explore_logs_permalink_clicked', {
      datasourceType: row.datasourceType ?? 'unknown',
      logRowUid: row.uid,
      logRowLevel: row.logLevel,
    });
  };

  const scrollIntoView = (element: HTMLElement) => {
    if (config.featureToggles.logsInfiniteScrolling) {
      if (logsContainer) {
        topLogsRef.current?.scrollIntoView();
        logsContainer.scroll({
          behavior: 'smooth',
          top: logsContainer.scrollTop + element.getBoundingClientRect().top - window.innerHeight / 2,
        });
      }

      return;
    }
    const { scrollElement } = props;

    if (scrollElement) {
      scrollElement.scroll({
        behavior: 'smooth',
        top: scrollElement.scrollTop + element.getBoundingClientRect().top - window.innerHeight / 2,
      });
    }
  };

  const checkUnescapedContent = memoizeOne((logRows: LogRowModel[]) => {
    return !!logRows.some((r) => r.hasUnescapedContent);
  });

  const dedupRows = memoizeOne((logRows: LogRowModel[], dedupStrategy: LogsDedupStrategy) => {
    const dedupedRows = dedupLogRows(logRows, dedupStrategy);
    const dedupCount = dedupedRows.reduce((sum, row) => (row.duplicates ? sum + row.duplicates : sum), 0);
    return { dedupedRows, dedupCount };
  });

  const filterRows = memoizeOne((logRows: LogRowModel[], hiddenLogLevels: LogLevel[]) => {
    return filterLogLevels(logRows, new Set(hiddenLogLevels));
  });

  const createNavigationRange = memoizeOne((logRows: LogRowModel[]): { from: number; to: number } | undefined => {
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

  const scrollToTopLogs = () => {
    if (config.featureToggles.logsInfiniteScrolling) {
      if (logsContainer) {
        logsContainer.scroll({
          behavior: 'auto',
          top: 0,
        });
      }
    }
    topLogsRef.current?.scrollIntoView();
  };

  const hasUnescapedContent = checkUnescapedContent(logRows);
  const filteredLogs = filterRows(logRows, hiddenLogLevels);
  const { dedupedRows, dedupCount } = dedupRows(filteredLogs, dedupStrategy);
  const navigationRange = createNavigationRange(logRows);

  return (
    <>
      {getRowContext && contextRow && (
        <LogRowContextModal
          open={contextOpen}
          row={contextRow}
          onClose={onCloseContext}
          getRowContext={(row, options) => getRowContext(row, contextRow, options)}
          getRowContextQuery={getRowContextQuery}
          getLogRowContextUi={getLogRowContextUi}
          logsSortOrder={logsSortOrder}
          timeZone={timeZone}
        />
      )}
      <PanelChrome
        title="Logs volume"
        collapsible
        collapsed={!logsVolumeEnabled}
        onToggleCollapse={onToggleLogsVolumeCollapse}
      >
        {logsVolumeEnabled && (
          <LogsVolumePanelList
            toggleLegendRef={toggleLegendRef}
            absoluteRange={absoluteRange}
            width={width}
            logsVolumeData={logsVolumeData}
            onUpdateTimeRange={onChangeTime}
            timeZone={timeZone}
            splitOpen={splitOpen}
            onLoadLogsVolume={loadLogsVolumeData}
            onHiddenSeriesChanged={onToggleLogLevel}
            eventBus={logsVolumeEventBus}
            onClose={() => onToggleLogsVolumeCollapse(true)}
          />
        )}
      </PanelChrome>
      <PanelChrome
        titleItems={[
          config.featureToggles.logsExploreTableVisualisation ? (
            visualisationType === 'logs' ? null : (
              <PanelChrome.TitleItem title="Feedback" key="A">
                <LogsFeedback feedbackUrl="https://forms.gle/5YyKdRQJ5hzq4c289" />
              </PanelChrome.TitleItem>
            )
          ) : null,
        ]}
        title={'Logs'}
        actions={
          <>
            {config.featureToggles.logsExploreTableVisualisation && (
              <div className={styles.visualisationType}>
                <RadioButtonGroup
                  className={styles.visualisationTypeRadio}
                  options={[
                    {
                      label: 'Logs',
                      value: 'logs',
                      description: 'Show results in logs visualisation',
                    },
                    {
                      label: 'Table',
                      value: 'table',
                      description: 'Show results in table visualisation',
                    },
                  ]}
                  size="sm"
                  value={visualisationType}
                  onChange={onChangeVisualisation}
                />
              </div>
            )}
          </>
        }
        loadingState={loading ? LoadingState.Loading : LoadingState.Done}
      >
        <div className={styles.stickyNavigation}>
          {visualisationType !== 'table' && (
            <div className={styles.logOptions}>
              <InlineFieldRow>
                <InlineField label="Time" className={styles.horizontalInlineLabel} transparent>
                  <InlineSwitch
                    value={showTime}
                    onChange={onChangeShowTime}
                    className={styles.horizontalInlineSwitch}
                    transparent
                    id={`show-time_${exploreId}`}
                  />
                </InlineField>
                <InlineField label="Unique labels" className={styles.horizontalInlineLabel} transparent>
                  <InlineSwitch
                    value={showLabels}
                    onChange={onChangeLabels}
                    className={styles.horizontalInlineSwitch}
                    transparent
                    id={`unique-labels_${exploreId}`}
                  />
                </InlineField>
                <InlineField label="Wrap lines" className={styles.horizontalInlineLabel} transparent>
                  <InlineSwitch
                    value={wrapLogMessage}
                    onChange={onChangeWrapLogMessage}
                    className={styles.horizontalInlineSwitch}
                    transparent
                    id={`wrap-lines_${exploreId}`}
                  />
                </InlineField>
                <InlineField label="Prettify JSON" className={styles.horizontalInlineLabel} transparent>
                  <InlineSwitch
                    value={prettifyLogMessage}
                    onChange={onChangePrettifyLogMessage}
                    className={styles.horizontalInlineSwitch}
                    transparent
                    id={`prettify_${exploreId}`}
                  />
                </InlineField>
                <InlineField label="Deduplication" className={styles.horizontalInlineLabel} transparent>
                  <RadioButtonGroup
                    options={DEDUP_OPTIONS.map((dedupType) => ({
                      label: capitalize(dedupType),
                      value: dedupType,
                      description: LogsDedupDescription[dedupType],
                    }))}
                    value={dedupStrategy}
                    onChange={onChangeDedup}
                    className={styles.radioButtons}
                  />
                </InlineField>
              </InlineFieldRow>

              <div>
                <InlineField
                  label="Display results"
                  className={styles.horizontalInlineLabel}
                  transparent
                  disabled={isFlipping || loading}
                >
                  <RadioButtonGroup
                    options={[
                      {
                        label: 'Newest first',
                        value: LogsSortOrder.Descending,
                        description: 'Show results newest to oldest',
                      },
                      {
                        label: 'Oldest first',
                        value: LogsSortOrder.Ascending,
                        description: 'Show results oldest to newest',
                      },
                    ]}
                    value={logsSortOrder}
                    onChange={onChangeLogsSortOrder}
                    className={styles.radioButtons}
                  />
                </InlineField>
              </div>
            </div>
          )}
          <div ref={topLogsRef} />
          <LogsMetaRow
            logRows={logRows}
            meta={logsMeta || []}
            dedupStrategy={dedupStrategy}
            dedupCount={dedupCount}
            hasUnescapedContent={hasUnescapedContent}
            forceEscape={forceEscape}
            displayedFields={displayedFields}
            onEscapeNewlines={onEscapeNewlines}
            clearDetectedFields={clearDetectedFields}
          />
        </div>
        <div className={cx(styles.logsSection, visualisationType === 'table' ? styles.logsTable : undefined)}>
          {visualisationType === 'table' && hasData && (
            <div className={styles.logRows} data-testid="logRowsTable">
              {/* Width should be full width minus logs navigation and padding */}
              <LogsTableWrap
                logsSortOrder={logsSortOrder}
                range={props.range}
                splitOpen={splitOpen}
                timeZone={timeZone}
                width={width - 80}
                logsFrames={props.logsFrames ?? []}
                onClickFilterLabel={onClickFilterLabel}
                onClickFilterOutLabel={onClickFilterOutLabel}
                panelState={panelState?.logs}
                theme={theme}
                updatePanelState={updatePanelState}
                datasourceType={props.datasourceType}
              />
            </div>
          )}
          {visualisationType === 'logs' && hasData && (
            <div
              className={config.featureToggles.logsInfiniteScrolling ? styles.scrollableLogRows : styles.logRows}
              data-testid="logRows"
              ref={onLogsContainerRef}
            >
              <InfiniteScroll
                loading={loading}
                loadMoreLogs={loadMoreLogs}
                range={props.range}
                timeZone={timeZone}
                rows={logRows}
                scrollElement={logsContainer}
                sortOrder={logsSortOrder}
              >
                <LogRows
                  logRows={logRows}
                  deduplicatedRows={dedupedRows}
                  dedupStrategy={dedupStrategy}
                  onClickFilterLabel={onClickFilterLabel}
                  onClickFilterOutLabel={onClickFilterOutLabel}
                  showContextToggle={showContextToggle}
                  getRowContextQuery={getRowContextQuery}
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
                  onClickShowField={showField}
                  onClickHideField={hideField}
                  app={CoreApp.Explore}
                  onLogRowHover={onLogRowHover}
                  onOpenContext={onOpenContext}
                  onPermalinkClick={onPermalinkClick}
                  permalinkedRowId={panelState?.logs?.id}
                  scrollIntoView={scrollIntoView}
                  isFilterLabelActive={props.isFilterLabelActive}
                  containerRendered={!!logsContainer}
                  onClickFilterValue={props.onClickFilterValue}
                  onClickFilterOutValue={props.onClickFilterOutValue}
                />
              </InfiniteScroll>
            </div>
          )}
          {!loading && !hasData && !scanning && (
            <div className={styles.logRows}>
              <div className={styles.noData}>
                No logs found.
                <Button size="sm" variant="secondary" onClick={onClickScan}>
                  Scan for older logs
                </Button>
              </div>
            </div>
          )}
          {scanning && (
            <div className={styles.logRows}>
              <div className={styles.noData}>
                <span>{scanText}</span>
                <Button size="sm" variant="secondary" onClick={onClickStopScan}>
                  Stop scan
                </Button>
              </div>
            </div>
          )}
          <LogsNavigation
            logsSortOrder={logsSortOrder}
            visibleRange={navigationRange ?? absoluteRange}
            absoluteRange={absoluteRange}
            timeZone={timeZone}
            onChangeTime={onChangeTime}
            loading={loading}
            queries={logsQueries ?? []}
            scrollToTopLogs={scrollToTopLogs}
            addResultsToCache={addResultsToCache}
            clearCache={clearCache}
          />
        </div>
      </PanelChrome>
    </>
  );
};

export const Logs = withTheme2(UnthemedLogs);

const getStyles = (theme: GrafanaTheme2, wrapLogMessage: boolean, tableHeight: number) => {
  return {
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
    horizontalInlineSwitch: css({
      padding: `0 ${theme.spacing(1)} 0 0`,
    }),
    radioButtons: css({
      margin: '0',
    }),
    logsSection: css({
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
    }),
    logsTable: css({
      maxHeight: `${tableHeight}px`,
    }),
    scrollableLogRows: css({
      overflowY: 'scroll',
      width: '100%',
      maxHeight: '75vh',
    }),
    logRows: css({
      overflowX: `${wrapLogMessage ? 'unset' : 'scroll'}`,
      overflowY: 'visible',
      width: '100%',
    }),
    visualisationType: css({
      display: 'flex',
      flex: '1',
      justifyContent: 'space-between',
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
