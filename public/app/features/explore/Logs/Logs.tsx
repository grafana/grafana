import { css, cx } from '@emotion/css';
import { capitalize, groupBy } from 'lodash';
import memoizeOne from 'memoize-one';
import { useCallback, useEffect, useState, useRef } from 'react';
import * as React from 'react';
import { usePrevious, useUnmount } from 'react-use';

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
  PopoverContent,
  RadioButtonGroup,
  SeriesVisibilityChangeMode,
  Themeable2,
  withTheme2,
} from '@grafana/ui';
import { mapMouseEventToMode } from '@grafana/ui/src/components/VizLegend/utils';
import { Trans } from 'app/core/internationalization';
import store from 'app/core/store';
import { createAndCopyShortLink } from 'app/core/utils/shortLinks';
import { InfiniteScroll } from 'app/features/logs/components/InfiniteScroll';
import { LogRows } from 'app/features/logs/components/LogRows';
import { LogRowContextModal } from 'app/features/logs/components/log-context/LogRowContextModal';
import { LogLevelColor, dedupLogRows, filterLogLevels } from 'app/features/logs/logsModel';
import { getLogLevel, getLogLevelFromKey, getLogLevelInfo } from 'app/features/logs/utils';
import { getState } from 'app/store/store';
import { ExploreItemState, useDispatch } from 'app/types';

import {
  contentOutlineTrackLevelFilter,
  contentOutlineTrackPinAdded,
  contentOutlineTrackPinClicked,
  contentOutlineTrackPinLimitReached,
  contentOutlineTrackPinRemoved,
  contentOutlineTrackUnpinClicked,
} from '../ContentOutline/ContentOutlineAnalyticEvents';
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
  onClickFilterString?: (value: string, refId?: string) => void;
  onClickFilterOutString?: (value: string, refId?: string) => void;
  loadMoreLogs?(range: AbsoluteTimeRange): void;
  onPinLineCallback?: () => void;
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

const PINNED_LOGS_LIMIT = 10;
const PINNED_LOGS_TITLE = 'Pinned log';
const PINNED_LOGS_MESSAGE = 'Pin to content outline';
const PINNED_LOGS_PANELID = 'Logs';

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
  const [pinLineButtonTooltipTitle, setPinLineButtonTooltipTitle] = useState<PopoverContent>(PINNED_LOGS_MESSAGE);
  const [visualisationType, setVisualisationType] = useState<LogsVisualisationType | undefined>(
    panelState?.logs?.visualisationType ?? getDefaultVisualisationType()
  );
  const [scrollIntoView, setScrollIntoView] = useState<((element: HTMLElement) => void) | undefined>(undefined);
  const logsContainerRef = useRef<HTMLDivElement | undefined>(undefined);
  const dispatch = useDispatch();
  const previousLoading = usePrevious(loading);

  const logsVolumeEventBus = eventBus.newScopedBus('logsvolume', { onlyLocal: false });
  const { register, unregister, outlineItems, updateItem, unregisterAllChildren } = useContentOutlineContext() ?? {};
  const flipOrderTimer = useRef<number | undefined>(undefined);
  const cancelFlippingTimer = useRef<number | undefined>(undefined);
  const toggleLegendRef = useRef<(name: string, mode: SeriesVisibilityChangeMode) => void>(() => {});
  const topLogsRef = useRef<HTMLDivElement>(null);

  const tableHeight = getLogsTableHeight();
  const styles = getStyles(theme, wrapLogMessage, tableHeight);
  const hasData = logRows && logRows.length > 0;
  const scanText = scanRange ? `Scanning ${rangeUtil.describeTimeRange(scanRange)}` : 'Scanning...';

  // Get pinned log lines
  const logsParent = outlineItems?.find((item) => item.panelId === PINNED_LOGS_PANELID && item.level === 'root');
  const pinnedLogs = logsParent?.children
    ?.filter((outlines) => outlines.title === PINNED_LOGS_TITLE)
    .map((pinnedLogs) => pinnedLogs.id);

  const getPinnedLogsCount = useCallback(() => {
    const logsParent = outlineItems?.find((item) => item.panelId === PINNED_LOGS_PANELID && item.level === 'root');
    return logsParent?.children?.filter((child) => child.title === PINNED_LOGS_TITLE).length ?? 0;
  }, [outlineItems]);

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
    if (unregisterAllChildren) {
      unregisterAllChildren((items) => {
        const logsParent = items?.find((item) => item.panelId === PINNED_LOGS_PANELID && item.level === 'root');
        return logsParent?.id;
      }, 'filter');
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
            panelId: PINNED_LOGS_PANELID,
            level: 'child',
            type: 'filter',
            highlight: currentLevelSelected && !allLevelsSelected,
            onClick: (e: React.MouseEvent) => {
              toggleLegendRef.current?.(level.levelStr, mapMouseEventToMode(e));
              contentOutlineTrackLevelFilter(level);
            },
            ref: null,
            color: LogLevelColor[level.logLevel],
          });
        }
      });
    }
  }, [logsVolumeData?.data, unregisterAllChildren, logsVolumeEnabled, hiddenLogLevels, register, toggleLegendRef]);

  useEffect(() => {
    if (getPinnedLogsCount() === PINNED_LOGS_LIMIT) {
      setPinLineButtonTooltipTitle(
        <span style={{ display: 'flex', textAlign: 'center' }}>
          ❗️
          <Trans i18nKey="explore.logs.maximum-pinned-logs">
            Maximum of {{ PINNED_LOGS_LIMIT }} pinned logs reached. Unpin a log to add another.
          </Trans>
        </span>
      );
    } else {
      setPinLineButtonTooltipTitle(PINNED_LOGS_MESSAGE);
    }
  }, [outlineItems, getPinnedLogsCount]);

  useEffect(() => {
    if (loading && !previousLoading && panelState?.logs?.id) {
      // loading stopped, so we need to remove any permalinked log lines
      delete panelState.logs.id;

      dispatch(
        changePanelState(exploreId, 'logs', {
          ...panelState,
        })
      );
    }
  }, [dispatch, exploreId, loading, panelState, previousLoading]);

  useEffect(() => {
    const visualisationType = panelState?.logs?.visualisationType ?? getDefaultVisualisationType();
    setVisualisationType(visualisationType);

    store.set(visualisationTypeKey, visualisationType);
  }, [panelState?.logs?.visualisationType]);

  useEffect(() => {
    registerLogLevelsWithContentOutline();
  }, [logsVolumeData?.data, hiddenLogLevels, registerLogLevelsWithContentOutline]);

  useUnmount(() => {
    if (flipOrderTimer) {
      window.clearTimeout(flipOrderTimer.current);
    }
    if (cancelFlippingTimer) {
      window.clearTimeout(cancelFlippingTimer.current);
    }
  });

  useUnmount(() => {
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
  });

  const updatePanelState = useCallback(
    (logsPanelState: Partial<ExploreLogsPanelState>) => {
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
    },
    [dispatch, exploreId, panelState?.logs?.columns, panelState?.logs?.refId, visualisationType]
  );

  // actions
  const onLogRowHover = useCallback(
    (row?: LogRowModel) => {
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
    },
    [props.eventBus]
  );

  const onLogsContainerRef = useCallback(
    (node: HTMLDivElement) => {
      logsContainerRef.current = node;

      // In theory this should be just a function passed down to LogRows but:
      // - LogRow.componentDidMount which calls scrollIntoView is called BEFORE the logsContainerRef is set
      // - the if check below if (logsContainerRef.current) was falsy and scrolling doesn't happen
      // - and LogRow.scrollToLogRow marks the line as scrolled anyway (and won't perform scrolling when the ref is set)
      // - see more details in https://github.com/facebook/react/issues/29897
      // We can change it once LogRow is converted into a functional component
      setScrollIntoView(() => (element: HTMLElement) => {
        if (config.featureToggles.logsInfiniteScrolling) {
          if (logsContainerRef.current) {
            topLogsRef.current?.scrollIntoView();
            logsContainerRef.current.scroll({
              behavior: 'smooth',
              top: logsContainerRef.current.scrollTop + element.getBoundingClientRect().top - window.innerHeight / 2,
            });
          }

          return;
        }
        const scrollElement = props.scrollElement;

        if (scrollElement) {
          scrollElement.scroll({
            behavior: 'smooth',
            top: scrollElement.scrollTop + element.getBoundingClientRect().top - window.innerHeight / 2,
          });
        }
      });
    },
    [props.scrollElement]
  );

  const onChangeLogsSortOrder = () => {
    setIsFlipping(true);
    // we are using setTimeout here to make sure that disabled button is rendered before the rendering of reordered logs
    flipOrderTimer.current = window.setTimeout(() => {
      const newSortOrder =
        logsSortOrder === LogsSortOrder.Descending ? LogsSortOrder.Ascending : LogsSortOrder.Descending;
      store.set(SETTINGS_KEYS.logsSortOrder, newSortOrder);
      setLogsSortOrder(newSortOrder);
    }, 0);
    cancelFlippingTimer.current = window.setTimeout(() => setIsFlipping(false), 1000);
  };

  const onEscapeNewlines = useCallback(() => {
    setForceEscape(!forceEscape);
  }, [forceEscape]);

  const onChangeVisualisation = useCallback(
    (visualisation: LogsVisualisationType) => {
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
    },
    [panelState?.logs, props.datasourceType, updatePanelState]
  );

  const onChangeDedup = useCallback(
    (dedupStrategy: LogsDedupStrategy) => {
      reportInteraction('grafana_explore_logs_deduplication_clicked', {
        deduplicationType: dedupStrategy,
        datasourceType: props.datasourceType,
      });
      setDedupStrategy(dedupStrategy);
    },
    [props.datasourceType]
  );

  const onChangeLabels = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { target } = event;
    if (target) {
      const showLabels = target.checked;

      setShowLabels(showLabels);
      store.set(SETTINGS_KEYS.showLabels, showLabels);
    }
  }, []);

  const onChangeShowTime = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { target } = event;
    if (target) {
      const showTime = target.checked;

      setShowTime(showTime);
      store.set(SETTINGS_KEYS.showTime, showTime);
    }
  }, []);

  const onChangeWrapLogMessage = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { target } = event;
    if (target) {
      const wrapLogMessage = target.checked;

      setWrapLogMessage(wrapLogMessage);
      store.set(SETTINGS_KEYS.wrapLogMessage, wrapLogMessage);
    }
  }, []);

  const onChangePrettifyLogMessage = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { target } = event;
    if (target) {
      const prettifyLogMessage = target.checked;

      setPrettifyLogMessage(prettifyLogMessage);
      store.set(SETTINGS_KEYS.prettifyLogMessage, prettifyLogMessage);
    }
  }, []);

  const onToggleLogLevel = useCallback((hiddenRawLevels: string[]) => {
    const hiddenLogLevels = hiddenRawLevels.map((level) => getLogLevelFromKey(level));
    setHiddenLogLevels(hiddenLogLevels);
  }, []);

  const onToggleLogsVolumeCollapse = useCallback(
    (collapsed: boolean) => {
      props.onSetLogsVolumeEnabled(!collapsed);
      reportInteraction('grafana_explore_logs_histogram_toggle_clicked', {
        datasourceType: props.datasourceType,
        type: !collapsed ? 'open' : 'close',
      });
    },
    [props]
  );

  const onClickScan = useCallback(
    (event: React.SyntheticEvent) => {
      event.preventDefault();
      if (props.onStartScanning) {
        props.onStartScanning();
        reportInteraction('grafana_explore_logs_scanning_button_clicked', {
          type: 'start',
          datasourceType: props.datasourceType,
        });
      }
    },
    [props]
  );

  const onClickStopScan = useCallback(
    (event: React.SyntheticEvent) => {
      event.preventDefault();
      if (props.onStopScanning) {
        props.onStopScanning();
      }
    },
    [props]
  );

  const showField = useCallback(
    (key: string) => {
      const index = displayedFields.indexOf(key);

      if (index === -1) {
        setDisplayedFields(displayedFields.concat(key));
      }
    },
    [displayedFields]
  );

  const hideField = useCallback(
    (key: string) => {
      const index = displayedFields.indexOf(key);
      if (index > -1) {
        setDisplayedFields(displayedFields.filter((k) => key !== k));
      }
    },
    [displayedFields]
  );

  const clearDetectedFields = useCallback(() => {
    setDisplayedFields([]);
  }, []);

  const onCloseCallbackRef = useRef<() => void>(() => {});

  let onCloseContext = useCallback(() => {
    setContextOpen(false);
    setContextRow(undefined);
    reportInteraction('grafana_explore_logs_log_context_closed', {
      datasourceType: contextRow?.datasourceType,
      logRowUid: contextRow?.uid,
    });
    onCloseCallbackRef?.current();
  }, [contextRow?.datasourceType, contextRow?.uid, onCloseCallbackRef]);

  const onOpenContext = (row: LogRowModel, onClose: () => void) => {
    // we are setting the `contextOpen` open state and passing it down to the `LogRow` in order to highlight the row when a LogContext is open
    setContextOpen(true);
    setContextRow(row);
    reportInteraction('grafana_explore_logs_log_context_opened', {
      datasourceType: row.datasourceType,
      logRowUid: row.uid,
    });
    onCloseCallbackRef.current = onClose;
  };

  const getPreviousLog = useCallback((row: LogRowModel, allLogs: LogRowModel[]) => {
    for (let i = allLogs.indexOf(row) - 1; i >= 0; i--) {
      if (allLogs[i].timeEpochMs > row.timeEpochMs) {
        return allLogs[i];
      }
    }

    return null;
  }, []);

  const getPermalinkRange = useCallback(
    (row: LogRowModel) => {
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
    },
    [absoluteRange.from, absoluteRange.to, getPreviousLog, logRows]
  );

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

  const scrollToTopLogs = useCallback(() => {
    if (config.featureToggles.logsInfiniteScrolling) {
      if (logsContainerRef.current) {
        logsContainerRef.current.scroll({
          behavior: 'auto',
          top: 0,
        });
      }
    }
    topLogsRef.current?.scrollIntoView();
  }, [logsContainerRef, topLogsRef]);

  const onPinToContentOutlineClick = (row: LogRowModel, allowUnPin = true) => {
    if (getPinnedLogsCount() === PINNED_LOGS_LIMIT && !allowUnPin) {
      contentOutlineTrackPinLimitReached();
      return;
    }

    // find the Logs parent item
    const logsParent = outlineItems?.find((item) => item.panelId === PINNED_LOGS_PANELID && item.level === 'root');

    //update the parent's expanded state
    if (logsParent && updateItem) {
      updateItem(logsParent.id, { expanded: true });
    }

    const alreadyPinned = pinnedLogs?.find((pin) => pin === row.rowId);
    if (alreadyPinned && row.rowId && allowUnPin) {
      unregister?.(row.rowId);
      contentOutlineTrackPinRemoved();
    } else if (getPinnedLogsCount() !== PINNED_LOGS_LIMIT && !alreadyPinned) {
      register?.({
        id: row.rowId,
        icon: 'gf-logs',
        title: PINNED_LOGS_TITLE,
        panelId: PINNED_LOGS_PANELID,
        level: 'child',
        ref: null,
        color: LogLevelColor[row.logLevel],
        childOnTop: true,
        onClick: () => {
          onOpenContext(row, () => {});
          contentOutlineTrackPinClicked();
        },
        onRemove: (id: string) => {
          unregister?.(id);
          contentOutlineTrackUnpinClicked();
        },
      });
      contentOutlineTrackPinAdded();
    }

    props.onPinLineCallback?.();
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
                scrollElement={logsContainerRef.current}
                sortOrder={logsSortOrder}
                app={CoreApp.Explore}
              >
                <LogRows
                  pinnedLogs={pinnedLogs}
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
                  containerRendered={!!logsContainerRef}
                  onClickFilterString={props.onClickFilterString}
                  onClickFilterOutString={props.onClickFilterOutString}
                  onUnpinLine={onPinToContentOutlineClick}
                  onPinLine={onPinToContentOutlineClick}
                  pinLineButtonTooltipTitle={pinLineButtonTooltipTitle}
                />
              </InfiniteScroll>
            </div>
          )}
          {!loading && !hasData && !scanning && (
            <div className={styles.logRows}>
              <div className={styles.noData}>
                <Trans i18nKey="explore.logs.no-logs-found">No logs found.</Trans>
                <Button size="sm" variant="secondary" onClick={onClickScan}>
                  <Trans i18nKey="explore.logs.scan-for-older-logs">Scan for older logs</Trans>
                </Button>
              </div>
            </div>
          )}
          {scanning && (
            <div className={styles.logRows}>
              <div className={styles.noData}>
                <span>{scanText}</span>
                <Button size="sm" variant="secondary" onClick={onClickStopScan}>
                  <Trans i18nKey="explore.logs.stop-scan">Stop scan</Trans>
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
      position: 'relative',
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

const checkUnescapedContent = memoizeOne((logRows: LogRowModel[]) => {
  return logRows.some((r) => r.hasUnescapedContent);
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
