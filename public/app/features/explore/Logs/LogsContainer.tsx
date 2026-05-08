import { memo, useCallback, useEffect, useState, type ReactNode } from 'react';
import { connect, type ConnectedProps } from 'react-redux';

import {
  type AbsoluteTimeRange,
  hasLogsContextSupport,
  hasLogsContextUiSupport,
  type LoadingState,
  type LogRowModel,
  type RawTimeRange,
  type EventBus,
  type SplitOpen,
  type DataFrame,
  SupplementaryQueryType,
  type DataQueryResponse,
  type LogRowContextOptions,
  type DataSourceWithLogsContextSupport,
  type DataSourceApi,
  hasToggleableQueryFiltersSupport,
  type DataSourceWithQueryModificationSupport,
  hasQueryModificationSupport,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';
import { PanelChrome } from '@grafana/ui';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { type GetFieldLinksFn } from 'app/plugins/panel/logs/types';
import { type ExploreItemState } from 'app/types/explore';
import { type StoreState } from 'app/types/store';

import { getTimeZone } from '../../profile/state/selectors';
import { loadSupplementaryQueryData, selectIsWaitingForData, setSupplementaryQueryEnabled } from '../state/query';
import { updateTimeRange, loadMoreLogs } from '../state/time';
import { LiveTailControls } from '../useLiveTailControls';
import { getFieldLinksForExplore } from '../utils/links';

import { LiveLogsWithTheme } from './LiveLogs';
import { Logs } from './Logs';
import { LogsCrossFadeTransition } from './utils/LogsCrossFadeTransition';

interface LogsContainerProps extends PropsFromRedux {
  width: number;
  exploreId: string;
  scanRange?: RawTimeRange;
  syncedTimes: boolean;
  loadingState: LoadingState;
  onClickFilterLabel: (key: string, value: string, frame?: DataFrame) => void;
  onClickFilterOutLabel: (key: string, value: string, frame?: DataFrame) => void;
  onStartScanning: () => void;
  onStopScanning: () => void;
  eventBus: EventBus;
  splitOpenFn: SplitOpen;
  isFilterLabelActive: (key: string, value: string, refId?: string) => Promise<boolean>;
  onClickFilterString: (value: string, refId?: string) => void;
  onClickFilterOutString: (value: string, refId?: string) => void;
  onPinLineCallback?: () => void;
}

type DataSourceInstance =
  | DataSourceApi<DataQuery>
  | (DataSourceApi<DataQuery> & DataSourceWithLogsContextSupport<DataQuery>)
  | (DataSourceApi<DataQuery> & DataSourceWithQueryModificationSupport<DataQuery>);

const LogsContainer = memo(function LogsContainer({
  loading,
  loadingState,
  logRows,
  logsMeta,
  logsSeries,
  logsQueries,
  onClickFilterLabel,
  onClickFilterOutLabel,
  onStartScanning,
  onStopScanning,
  absoluteRange,
  timeZone,
  visibleRange,
  scanning,
  range,
  width,
  splitOpenFn,
  isLive,
  isPaused,
  clearedAtIndex,
  exploreId,
  logsVolume,
  onPinLineCallback,
  datasourceInstance,
  panelState,
  logsFrames,
  isFilterLabelActive,
  onClickFilterString,
  onClickFilterOutString,
  eventBus,
  updateTimeRange,
  loadMoreLogs,
  loadSupplementaryQueryData,
  setSupplementaryQueryEnabled,
}: LogsContainerProps) {
  const [dsInstances, setDsInstances] = useState<Record<string, DataSourceInstance>>({});

  const updateDataSourceInstances = useCallback(() => {
    if (!logsQueries || !datasourceInstance) {
      return;
    }

    const instances: Record<string, DataSourceInstance> = {};

    // Not in mixed mode.
    if (datasourceInstance.uid !== MIXED_DATASOURCE_NAME) {
      logsQueries.forEach(({ refId }) => {
        instances[refId] = datasourceInstance;
      });
      setDsInstances(instances);
      return;
    }

    // Mixed mode.
    const dsPromises: Array<Promise<{ ds: DataSourceApi; refId: string }>> = [];
    for (const query of logsQueries) {
      if (!query.datasource) {
        continue;
      }
      const mustCheck = !instances[query.refId] || instances[query.refId].uid !== query.datasource.uid;
      if (mustCheck) {
        dsPromises.push(
          new Promise((resolve) => {
            getDataSourceSrv()
              .get(query.datasource)
              .then((ds) => {
                resolve({ ds, refId: query.refId });
              });
          })
        );
      }
    }

    if (!dsPromises.length) {
      return;
    }

    Promise.all(dsPromises).then((resolved) => {
      resolved.forEach(({ ds, refId }) => {
        instances[refId] = ds;
      });
      setDsInstances(instances);
    });
  }, [logsQueries, datasourceInstance]);

  useEffect(() => {
    updateDataSourceInstances();
  }, [updateDataSourceInstances]);

  function onChangeTime(absoluteRange: AbsoluteTimeRange) {
    updateTimeRange({ exploreId, absoluteRange });
  }

  function handleLoadMoreLogs(absoluteRange: AbsoluteTimeRange) {
    loadMoreLogs({ exploreId, absoluteRange });
  }

  function getQuery(
    queries: DataQuery[] | undefined,
    row: LogRowModel,
    datasource: DataSourceApi<DataQuery> & DataSourceWithLogsContextSupport<DataQuery>
  ) {
    return (queries ?? []).find(
      (q) => q.refId === row.dataFrame.refId && q.datasource != null && q.datasource.type === datasource.type
    );
  }

  async function getLogRowContext(
    row: LogRowModel,
    origRow: LogRowModel,
    options: LogRowContextOptions
  ): Promise<DataQueryResponse> {
    if (!origRow.dataFrame.refId || !dsInstances[origRow.dataFrame.refId]) {
      return { data: [] };
    }

    const ds = dsInstances[origRow.dataFrame.refId];
    if (!hasLogsContextSupport(ds)) {
      return { data: [] };
    }

    const query = getQuery(logsQueries, origRow, ds);
    return query ? ds.getLogRowContext(row, options, query) : { data: [] };
  }

  async function getLogRowContextQuery(
    row: LogRowModel,
    options?: LogRowContextOptions,
    cacheFilters = true
  ): Promise<DataQuery | null> {
    if (!row.dataFrame.refId || !dsInstances[row.dataFrame.refId]) {
      return null;
    }

    const ds = dsInstances[row.dataFrame.refId];
    if (!hasLogsContextSupport(ds)) {
      return null;
    }

    const query = getQuery(logsQueries, row, ds);
    return query && ds.getLogRowContextQuery ? ds.getLogRowContextQuery(row, options, query, cacheFilters) : null;
  }

  function getLogRowContextUi(row: LogRowModel, runContextQuery?: () => void): ReactNode {
    if (!row.dataFrame.refId || !dsInstances[row.dataFrame.refId]) {
      return <></>;
    }

    const ds = dsInstances[row.dataFrame.refId];
    if (!hasLogsContextSupport(ds)) {
      return <></>;
    }

    const query = getQuery(logsQueries, row, ds);
    return query && hasLogsContextUiSupport(ds) && ds.getLogRowContextUi ? (
      ds.getLogRowContextUi(row, runContextQuery, query)
    ) : (
      <></>
    );
  }

  function showContextToggle(row?: LogRowModel): boolean {
    if (!row?.dataFrame.refId || !dsInstances[row.dataFrame.refId]) {
      return false;
    }
    return hasLogsContextSupport(dsInstances[row.dataFrame.refId]);
  }

  const getFieldLinks: GetFieldLinksFn = (field, rowIndex, dataFrame, vars) => {
    return getFieldLinksForExplore({ field, rowIndex, splitOpenFn, range, dataFrame, vars });
  };

  function logDetailsFilterAvailable() {
    return Object.values(dsInstances).some(
      (ds) => ds?.modifyQuery || hasQueryModificationSupport(ds) || hasToggleableQueryFiltersSupport(ds)
    );
  }

  function filterValueAvailable() {
    return Object.values(dsInstances).some(
      (ds) => hasQueryModificationSupport(ds) && ds?.getSupportedQueryModifications().includes('ADD_STRING_FILTER')
    );
  }

  function filterOutValueAvailable() {
    return Object.values(dsInstances).some(
      (ds) => hasQueryModificationSupport(ds) && ds?.getSupportedQueryModifications().includes('ADD_STRING_FILTER_OUT')
    );
  }

  function loadLogsVolumeData() {
    loadSupplementaryQueryData(exploreId, SupplementaryQueryType.LogsVolume);
  }

  function onSetLogsVolumeEnabled(enabled: boolean) {
    setSupplementaryQueryEnabled(exploreId, enabled, SupplementaryQueryType.LogsVolume);
  }

  if (!logRows) {
    return null;
  }

  return (
    <>
      <LogsCrossFadeTransition visible={isLive}>
        <PanelChrome title={t('explore.logs-container.label-logs', 'Logs')}>
          <LiveTailControls exploreId={exploreId}>
            {(controls) => (
              <LiveLogsWithTheme
                logRows={logRows}
                timeZone={timeZone}
                stopLive={controls.stop}
                isPaused={isPaused}
                onPause={controls.pause}
                onResume={controls.resume}
                onClear={controls.clear}
                clearedAtIndex={clearedAtIndex}
              />
            )}
          </LiveTailControls>
        </PanelChrome>
      </LogsCrossFadeTransition>
      <LogsCrossFadeTransition visible={!isLive}>
        <Logs
          exploreId={exploreId}
          datasourceType={datasourceInstance?.type}
          logRows={logRows}
          logsMeta={logsMeta}
          logsSeries={logsSeries}
          logsVolumeEnabled={logsVolume.enabled}
          onSetLogsVolumeEnabled={onSetLogsVolumeEnabled}
          logsVolumeData={logsVolume.data}
          logsQueries={logsQueries}
          width={width}
          splitOpen={splitOpenFn}
          loading={loading}
          loadingState={loadingState}
          loadLogsVolumeData={loadLogsVolumeData}
          onChangeTime={onChangeTime}
          loadMoreLogs={handleLoadMoreLogs}
          onClickFilterLabel={logDetailsFilterAvailable() ? onClickFilterLabel : undefined}
          onClickFilterOutLabel={logDetailsFilterAvailable() ? onClickFilterOutLabel : undefined}
          onStartScanning={onStartScanning}
          onStopScanning={onStopScanning}
          absoluteRange={absoluteRange}
          visibleRange={visibleRange}
          timeZone={timeZone}
          scanning={scanning}
          scanRange={range.raw}
          showContextToggle={showContextToggle}
          getRowContext={getLogRowContext}
          getRowContextQuery={getLogRowContextQuery}
          getLogRowContextUi={getLogRowContextUi}
          getFieldLinks={getFieldLinks}
          eventBus={eventBus}
          panelState={panelState}
          logsFrames={logsFrames}
          isFilterLabelActive={logDetailsFilterAvailable() ? isFilterLabelActive : undefined}
          range={range}
          onPinLineCallback={onPinLineCallback}
          onClickFilterString={filterValueAvailable() ? onClickFilterString : undefined}
          onClickFilterOutString={filterOutValueAvailable() ? onClickFilterOutString : undefined}
        />
      </LogsCrossFadeTransition>
    </>
  );
});

function mapStateToProps(state: StoreState, { exploreId }: { exploreId: string }) {
  const explore = state.explore;
  const item: ExploreItemState = explore.panes[exploreId]!;
  const {
    logsResult,
    scanning,
    datasourceInstance,
    isLive,
    isPaused,
    clearedAtIndex,
    range,
    absoluteRange,
    supplementaryQueries,
  } = item;
  const loading = selectIsWaitingForData(exploreId)(state);
  const panelState = item.panelsState;
  const timeZone = getTimeZone(state.user);
  const logsVolume = supplementaryQueries[SupplementaryQueryType.LogsVolume];

  return {
    loading,
    logRows: logsResult?.rows,
    logsMeta: logsResult?.meta,
    logsSeries: logsResult?.series,
    logsQueries: logsResult?.queries,
    visibleRange: logsResult?.visibleRange,
    scanning,
    timeZone,
    datasourceInstance,
    isLive,
    isPaused,
    clearedAtIndex,
    range,
    absoluteRange,
    logsVolume,
    panelState,
    logsFrames: item.queryResponse.logsFrames,
  };
}

const mapDispatchToProps = {
  updateTimeRange,
  loadMoreLogs,
  loadSupplementaryQueryData,
  setSupplementaryQueryEnabled,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(LogsContainer);
