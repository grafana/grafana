import { css, cx } from '@emotion/css';
import { capitalize, groupBy } from 'lodash';
import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import * as React from 'react';
import { usePrevious, useUnmount } from 'react-use';

import {
  SplitOpen,
  LogRowModel,
  LogsMetaItem,
  DataFrame,
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
import { DataQuery } from '@grafana/schema';
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
import { mapMouseEventToMode } from '@grafana/ui/internal';
import { Trans, t } from 'app/core/internationalization';
import store from 'app/core/store';
import { createAndCopyShortLink, getLogsPermalinkRange } from 'app/core/utils/shortLinks';
import { ControlledLogRows } from 'app/features/logs/components/ControlledLogRows';
import { InfiniteScroll } from 'app/features/logs/components/InfiniteScroll';
import { LogRows } from 'app/features/logs/components/LogRows';
import { LogRowContextModal } from 'app/features/logs/components/log-context/LogRowContextModal';
import { LogList, LogListControlOptions } from 'app/features/logs/components/panel/LogList';
import { isDedupStrategy, isLogsSortOrder } from 'app/features/logs/components/panel/LogListContext';
import { LogLevelColor, dedupLogRows, filterLogLevels } from 'app/features/logs/logsModel';
import { getLogLevelFromKey, getLogLevelInfo } from 'app/features/logs/utils';
import { LokiQueryDirection } from 'app/plugins/datasource/loki/dataquery.gen';
import { isLokiQuery } from 'app/plugins/datasource/loki/queryUtils';
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
import { changeQueries, runQueries } from '../state/query';

import { LogsFeedback } from './LogsFeedback';
import { LogsMetaRow } from './LogsMetaRow';
import LogsNavigation from './LogsNavigation';
import { LogsTableWrap, getLogsTableHeight } from './LogsTableWrap';
import { LogsVolumePanelList } from './LogsVolumePanelList';
import { SETTING_KEY_ROOT, SETTINGS_KEYS, visualisationTypeKey } from './utils/logs';

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
  getRowContext?: (row: LogRowModel, origRow: LogRowModel, options: LogRowContextOptions) => Promise<DataQueryResponse>;
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
    onPinLineCallback,
    scrollElement,
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
  const [contextOpen, setContextOpen] = useState<boolean>(false);
  const [contextRow, setContextRow] = useState<LogRowModel | undefined>(undefined);
  const [pinLineButtonTooltipTitle, setPinLineButtonTooltipTitle] = useState<PopoverContent>(PINNED_LOGS_MESSAGE);
  const [visualisationType, setVisualisationType] = useState<LogsVisualisationType>(
    panelState?.logs?.visualisationType ?? getDefaultVisualisationType()
  );
  const logsContainerRef = useRef<HTMLDivElement | null>(null);
  const dispatch = useDispatch();
  const previousLoading = usePrevious(loading);

  const logsVolumeEventBus = eventBus.newScopedBus('logsvolume', { onlyLocal: false });
  const { register, unregister, outlineItems, updateItem, unregisterAllChildren } = useContentOutlineContext() ?? {};
  const flipOrderTimer = useRef<number | undefined>(undefined);
  const cancelFlippingTimer = useRef<number | undefined>(undefined);
  const toggleLegendRef = useRef<(name: string, mode: SeriesVisibilityChangeMode) => void>(() => {});
  const topLogsRef = useRef<HTMLDivElement>(null);
  const logLevelsRef = useRef<LogLevel[] | null>(null);

  const tableHeight = getLogsTableHeight();
  const setWrapperLineWrapStyles = wrapLogMessage || visualisationType === 'table';
  const styles = getStyles(theme, setWrapperLineWrapStyles, tableHeight);
  const hasData = logRows && logRows.length > 0;
  const scanText = scanRange ? `Scanning ${rangeUtil.describeTimeRange(scanRange)}` : 'Scanning...';

  // Get pinned log lines
  const logsParent = outlineItems?.find((item) => item.panelId === PINNED_LOGS_PANELID && item.level === 'root');
  const pinnedLogs = useMemo(
    () =>
      logsParent?.children
        ?.filter((outlines) => outlines.title === PINNED_LOGS_TITLE)
        .map((pinnedLogs) => pinnedLogs.id),
    [logsParent?.children]
  );

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
    const logLevelsArray: LogLevel[] = [];
    logVolumeDataFrames.forEach((dataFrame) => {
      const { level } = getLogLevelInfo(dataFrame, logsVolumeData?.data ?? []);
      logLevelsArray.push(getLogLevelFromKey(level));
    });

    const sortedLLArray = logLevelsArray.sort((a: string, b: string) =>
      levelsArr.indexOf(a) > levelsArr.indexOf(b) ? 1 : -1
    );

    const logLevels = new Set(sortedLLArray);
    logLevelsRef.current = Array.from(logLevels);

    if (logLevels.size > 1 && logsVolumeEnabled && numberOfLogVolumes === 1) {
      logLevels.forEach((level) => {
        const allLevelsSelected = hiddenLogLevels.length === 0;
        const currentLevelSelected = !hiddenLogLevels.find((hiddenLevel) => hiddenLevel === level);
        if (register) {
          register({
            title: level,
            icon: 'gf-logs',
            panelId: PINNED_LOGS_PANELID,
            level: 'child',
            type: 'filter',
            highlight: currentLevelSelected && !allLevelsSelected,
            onClick: (e: React.MouseEvent) => {
              toggleLegendRef.current?.(level, mapMouseEventToMode(e));
              contentOutlineTrackLevelFilter(level);
            },
            ref: null,
            color: LogLevelColor[level],
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
    let displayedFields: string[] = [];
    if (Array.isArray(panelState?.logs?.displayedFields)) {
      displayedFields = panelState?.logs?.displayedFields;
    } else if (panelState?.logs?.displayedFields && typeof panelState?.logs?.displayedFields === 'object') {
      displayedFields = Object.values(panelState?.logs?.displayedFields);
    }
    setDisplayedFields(displayedFields);
  }, [panelState?.logs?.displayedFields]);

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
    // If we're unmounting logs (e.g. switching to another datasource), we need to remove the logs specific panel state, otherwise it will persist in the explore url
    if (
      panelState?.logs?.columns ||
      panelState?.logs?.refId ||
      panelState?.logs?.labelFieldName ||
      panelState?.logs?.displayedFields
    ) {
      dispatch(
        changePanelState(exploreId, 'logs', {
          ...panelState?.logs,
          columns: undefined,
          visualisationType: visualisationType,
          labelFieldName: undefined,
          refId: undefined,
          displayedFields: undefined,
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
            displayedFields: logsPanelState.displayedFields ?? panelState?.logs?.displayedFields,
          })
        );
      }
    },
    [
      dispatch,
      exploreId,
      panelState?.logs?.columns,
      panelState?.logs?.displayedFields,
      panelState?.logs?.refId,
      visualisationType,
    ]
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

  const scrollIntoView = useCallback(
    (element: HTMLElement) => {
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

      if (scrollElement) {
        scrollElement.scroll({
          behavior: 'smooth',
          top: scrollElement.scrollTop + element.getBoundingClientRect().top - window.innerHeight / 2,
        });
      }
    },
    [scrollElement]
  );

  const sortOrderChanged = useCallback(
    (newSortOrder: LogsSortOrder) => {
      if (!logsQueries) {
        return;
      }
      let hasLokiQueries = false;
      const newQueries = logsQueries.map((query) => {
        if (query.datasource?.type !== 'loki' || !isLokiQuery(query)) {
          return query;
        }
        if (query.direction === LokiQueryDirection.Scan) {
          // Don't override Scan. When the direction is Scan it means that the user specifically assigned this direction to the query.
          return query;
        }
        hasLokiQueries = true;
        const newDirection =
          newSortOrder === LogsSortOrder.Ascending ? LokiQueryDirection.Forward : LokiQueryDirection.Backward;
        if (newDirection !== query.direction) {
          query.direction = newDirection;
        }
        return query;
      });

      if (hasLokiQueries) {
        dispatch(changeQueries({ exploreId, queries: newQueries }));
        dispatch(runQueries({ exploreId }));
      }
    },
    [dispatch, exploreId, logsQueries]
  );

  const onChangeLogsSortOrder = useCallback(
    (newSortOrder: LogsSortOrder) => {
      setIsFlipping(true);
      // we are using setTimeout here to make sure that disabled button is rendered before the rendering of reordered logs
      flipOrderTimer.current = window.setTimeout(() => {
        store.set(SETTINGS_KEYS.logsSortOrder, newSortOrder);
        sortOrderChanged(newSortOrder);
        setLogsSortOrder(newSortOrder);
      }, 0);
      cancelFlippingTimer.current = window.setTimeout(() => setIsFlipping(false), 1000);
    },
    [sortOrderChanged]
  );

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
    const hiddenLogLevels = hiddenRawLevels.map(getLogLevelFromKey);
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
        const updatedDisplayedFields = displayedFields.concat(key);
        setDisplayedFields(updatedDisplayedFields);
        updatePanelState({
          ...panelState?.logs,
          displayedFields: updatedDisplayedFields,
        });
      }
    },
    [displayedFields, panelState?.logs, updatePanelState]
  );

  const hideField = useCallback(
    (key: string) => {
      const index = displayedFields.indexOf(key);
      if (index > -1) {
        const updatedDisplayedFields = displayedFields.filter((k) => key !== k);
        setDisplayedFields(updatedDisplayedFields);
        updatePanelState({
          ...panelState?.logs,
          displayedFields: updatedDisplayedFields,
        });
      }
    },
    [displayedFields, panelState?.logs, updatePanelState]
  );

  const clearDetectedFields = useCallback(() => {
    updatePanelState({
      ...panelState?.logs,
      displayedFields: [],
    });
    setDisplayedFields([]);
  }, [panelState?.logs, updatePanelState]);

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

  const onOpenContext = useCallback((row: LogRowModel, onClose: () => void) => {
    // we are setting the `contextOpen` open state and passing it down to the `LogRow` in order to highlight the row when a LogContext is open
    setContextOpen(true);
    setContextRow(row);
    reportInteraction('grafana_explore_logs_log_context_opened', {
      datasourceType: row.datasourceType,
      logRowUid: row.uid,
    });
    onCloseCallbackRef.current = onClose;
  }, []);

  const onPermalinkClick = useCallback(
    async (row: LogRowModel) => {
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
        logs: { id: row.uid, visualisationType: visualisationType ?? getDefaultVisualisationType(), displayedFields },
      };
      urlState.range = getLogsPermalinkRange(row, logRows, absoluteRange);

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
    },
    [absoluteRange, displayedFields, exploreId, logRows, panelState, visualisationType]
  );

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
  }, []);

  const onPinToContentOutlineClick = useCallback(
    (row: LogRowModel, allowUnPin = true) => {
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

      onPinLineCallback?.();
    },
    [getPinnedLogsCount, onOpenContext, onPinLineCallback, outlineItems, pinnedLogs, register, unregister, updateItem]
  );

  const hasUnescapedContent = useMemo(() => checkUnescapedContent(logRows), [logRows]);
  const filteredLogs = useMemo(() => filterRows(logRows, hiddenLogLevels), [hiddenLogLevels, logRows]);
  const { dedupedRows, dedupCount } = useMemo(
    () => dedupRows(filteredLogs, dedupStrategy),
    [dedupStrategy, filteredLogs]
  );
  const navigationRange = useMemo(() => createNavigationRange(logRows), [logRows]);
  const infiniteScrollAvailable = useMemo(
    () => !logsQueries?.some((query) => 'direction' in query && query.direction === LokiQueryDirection.Scan),
    [logsQueries]
  );

  const onLogOptionsChange = useCallback(
    (option: keyof LogListControlOptions, value: string | string[] | boolean) => {
      if (option === 'sortOrder' && isLogsSortOrder(value)) {
        sortOrderChanged(value);
      } else if (option === 'filterLevels' && Array.isArray(value)) {
        if (value.length === 0) {
          setHiddenLogLevels([]);
          return;
        }
        const allLevels = logLevelsRef.current ?? Object.keys(LogLevelColor).map(getLogLevelFromKey);
        if (hiddenLogLevels.length === 0) {
          toggleLegendRef.current?.(value[0], SeriesVisibilityChangeMode.ToggleSelection);
          setHiddenLogLevels(allLevels.filter((level) => level !== value[0]));
          return;
        }
        const appendsLevel = value.find((level) => hiddenLogLevels.includes(getLogLevelFromKey(level)));
        const removesLevel = allLevels.find((level) => !value.includes(level) && !hiddenLogLevels.includes(level));
        if (appendsLevel) {
          toggleLegendRef.current?.(appendsLevel, SeriesVisibilityChangeMode.AppendToSelection);
          setHiddenLogLevels(hiddenLogLevels.filter((hiddenLevel) => hiddenLevel === appendsLevel));
          return;
        } else if (removesLevel) {
          toggleLegendRef.current?.(removesLevel, SeriesVisibilityChangeMode.AppendToSelection);
          setHiddenLogLevels([...hiddenLogLevels, removesLevel]);
        }
      } else if (option === 'dedupStrategy' && isDedupStrategy(value)) {
        setDedupStrategy(value);
      }
    },
    [hiddenLogLevels, sortOrderChanged]
  );

  const filterLevels: LogLevel[] | undefined = useMemo(
    () =>
      !logLevelsRef.current
        ? undefined
        : logLevelsRef.current.filter((level) => hiddenLogLevels.length > 0 && !hiddenLogLevels.includes(level)),
    [hiddenLogLevels]
  );

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
        title={t('explore.unthemed-logs.title-logs-volume', 'Logs volume')}
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
              <PanelChrome.TitleItem title={t('explore.unthemed-logs.title-feedback', 'Feedback')} key="A">
                <LogsFeedback feedbackUrl="https://forms.gle/5YyKdRQJ5hzq4c289" />
              </PanelChrome.TitleItem>
            )
          ) : null,
        ]}
        title={t('explore.unthemed-logs.title-logs', 'Logs')}
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
          {visualisationType !== 'table' &&
            !config.featureToggles.newLogsPanel &&
            !config.featureToggles.logsPanelControls && (
              <div className={styles.logOptions}>
                <InlineFieldRow>
                  <InlineField
                    label={t('explore.unthemed-logs.label-time', 'Time')}
                    className={styles.horizontalInlineLabel}
                    transparent
                  >
                    <InlineSwitch
                      value={showTime}
                      onChange={onChangeShowTime}
                      className={styles.horizontalInlineSwitch}
                      transparent
                      id={`show-time_${exploreId}`}
                    />
                  </InlineField>
                  <InlineField
                    label={t('explore.unthemed-logs.label-unique-labels', 'Unique labels')}
                    className={styles.horizontalInlineLabel}
                    transparent
                  >
                    <InlineSwitch
                      value={showLabels}
                      onChange={onChangeLabels}
                      className={styles.horizontalInlineSwitch}
                      transparent
                      id={`unique-labels_${exploreId}`}
                    />
                  </InlineField>
                  <InlineField
                    label={t('explore.unthemed-logs.label-wrap-lines', 'Wrap lines')}
                    className={styles.horizontalInlineLabel}
                    transparent
                  >
                    <InlineSwitch
                      value={wrapLogMessage}
                      onChange={onChangeWrapLogMessage}
                      className={styles.horizontalInlineSwitch}
                      transparent
                      id={`wrap-lines_${exploreId}`}
                    />
                  </InlineField>
                  <InlineField
                    label={t('explore.unthemed-logs.label-prettify-json', 'Prettify JSON')}
                    className={styles.horizontalInlineLabel}
                    transparent
                  >
                    <InlineSwitch
                      value={prettifyLogMessage}
                      onChange={onChangePrettifyLogMessage}
                      className={styles.horizontalInlineSwitch}
                      transparent
                      id={`prettify_${exploreId}`}
                    />
                  </InlineField>
                  <InlineField
                    label={t('explore.unthemed-logs.label-deduplication', 'Deduplication')}
                    className={styles.horizontalInlineLabel}
                    transparent
                  >
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
                    label={t('explore.unthemed-logs.label-display-results', 'Display results')}
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
            displayedFields={displayedFields}
            clearDetectedFields={clearDetectedFields}
          />
        </div>
        <div className={cx(styles.logsSection, visualisationType === 'table' ? styles.logsTable : undefined)}>
          {!config.featureToggles.logsPanelControls && visualisationType === 'table' && hasData && (
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
          {!config.featureToggles.newLogsPanel && config.featureToggles.logsPanelControls && hasData && (
            <div className={styles.logRowsWrapper} data-testid="logRows">
              <ControlledLogRows
                logsTableFrames={props.logsFrames}
                width={width}
                updatePanelState={updatePanelState}
                panelState={panelState?.logs}
                datasourceType={props.datasourceType}
                splitOpen={splitOpen}
                visualisationType={visualisationType}
                loading={loading}
                loadMoreLogs={infiniteScrollAvailable ? loadMoreLogs : undefined}
                range={props.range}
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
                onClickFilterString={props.onClickFilterString}
                onClickFilterOutString={props.onClickFilterOutString}
                onUnpinLine={onPinToContentOutlineClick}
                onPinLine={onPinToContentOutlineClick}
                pinLineButtonTooltipTitle={pinLineButtonTooltipTitle}
                logsMeta={logsMeta}
                logOptionsStorageKey={SETTING_KEY_ROOT}
                onLogOptionsChange={onLogOptionsChange}
                hasUnescapedContent={hasUnescapedContent}
              />
            </div>
          )}
          {!config.featureToggles.logsPanelControls &&
            !config.featureToggles.newLogsPanel &&
            visualisationType === 'logs' &&
            hasData && (
              <>
                <div
                  className={config.featureToggles.logsInfiniteScrolling ? styles.scrollableLogRows : styles.logRows}
                  data-testid="logRows"
                  ref={logsContainerRef}
                >
                  <InfiniteScroll
                    loading={loading}
                    loadMoreLogs={infiniteScrollAvailable ? loadMoreLogs : undefined}
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
                      scrollElement={logsContainerRef.current}
                      onClickFilterString={props.onClickFilterString}
                      onClickFilterOutString={props.onClickFilterOutString}
                      onUnpinLine={onPinToContentOutlineClick}
                      onPinLine={onPinToContentOutlineClick}
                      pinLineButtonTooltipTitle={pinLineButtonTooltipTitle}
                      renderPreview
                    />
                  </InfiniteScroll>
                </div>
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
              </>
            )}
          {config.featureToggles.newLogsPanel && visualisationType === 'logs' && hasData && (
            <div data-testid="logRows" ref={logsContainerRef} className={styles.logRowsWrapper}>
              {logsContainerRef.current && (
                <LogList
                  app={CoreApp.Explore}
                  containerElement={logsContainerRef.current}
                  dedupStrategy={dedupStrategy}
                  displayedFields={displayedFields}
                  filterLevels={filterLevels}
                  getFieldLinks={getFieldLinks}
                  getRowContextQuery={getRowContextQuery}
                  loadMore={loadMoreLogs}
                  logOptionsStorageKey={SETTING_KEY_ROOT}
                  logs={dedupedRows}
                  logsMeta={logsMeta}
                  logSupportsContext={showContextToggle}
                  onLogOptionsChange={onLogOptionsChange}
                  onLogLineHover={onLogRowHover}
                  onOpenContext={onOpenContext}
                  onPermalinkClick={onPermalinkClick}
                  onPinLine={onPinToContentOutlineClick}
                  onUnpinLine={onPinToContentOutlineClick}
                  pinLineButtonTooltipTitle={pinLineButtonTooltipTitle}
                  pinnedLogs={pinnedLogs}
                  showControls
                  showTime={showTime}
                  sortOrder={logsSortOrder}
                  timeRange={props.range}
                  timeZone={timeZone}
                  wrapLogMessage={wrapLogMessage}
                />
              )}
            </div>
          )}
          {!loading && !hasData && !scanning && (
            <div className={styles.noDataWrapper}>
              <div className={styles.noData}>
                <Trans i18nKey="explore.logs.no-logs-found">No logs found.</Trans>
                <Button size="sm" variant="secondary" className={styles.scanButton} onClick={onClickScan}>
                  <Trans i18nKey="explore.logs.scan-for-older-logs">Scan for older logs</Trans>
                </Button>
              </div>
            </div>
          )}
          {scanning && (
            <div className={styles.noDataWrapper}>
              <div className={styles.noData}>
                <span>{scanText}</span>
                <Button size="sm" variant="secondary" className={styles.scanButton} onClick={onClickStopScan}>
                  <Trans i18nKey="explore.logs.stop-scan">Stop scan</Trans>
                </Button>
              </div>
            </div>
          )}
        </div>
      </PanelChrome>
    </>
  );
};

export const Logs = withTheme2(UnthemedLogs);

const getStyles = (theme: GrafanaTheme2, wrapLogMessage: boolean, tableHeight: number) => {
  return {
    noDataWrapper: css({
      display: 'flex',
      justifyContent: 'center',
      width: '100%',
      paddingBottom: theme.spacing(2),
    }),
    noData: css({
      display: 'inline-block',
    }),
    scanButton: css({
      marginLeft: theme.spacing(1),
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
    logRowsWrapper: css({
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

const checkUnescapedContent = (logRows: LogRowModel[]) => {
  return logRows.some((r) => r.hasUnescapedContent);
};

const dedupRows = (logRows: LogRowModel[], dedupStrategy: LogsDedupStrategy) => {
  const dedupedRows = dedupLogRows(logRows, dedupStrategy);
  const dedupCount = dedupedRows.reduce((sum, row) => (row.duplicates ? sum + row.duplicates : sum), 0);
  return { dedupedRows, dedupCount };
};

const filterRows = (logRows: LogRowModel[], hiddenLogLevels: string[]) => {
  return filterLogLevels(logRows, new Set(hiddenLogLevels));
};

const createNavigationRange = (logRows: LogRowModel[]): { from: number; to: number } | undefined => {
  if (!logRows || logRows.length === 0) {
    return undefined;
  }
  const firstTimeStamp = logRows[0].timeEpochMs;
  const lastTimeStamp = logRows[logRows.length - 1].timeEpochMs;

  if (lastTimeStamp < firstTimeStamp) {
    return { from: lastTimeStamp, to: firstTimeStamp };
  }

  return { from: firstTimeStamp, to: lastTimeStamp };
};
