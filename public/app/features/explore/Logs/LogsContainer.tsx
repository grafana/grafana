import { PureComponent } from 'react';
import * as React from 'react';
import { connect, ConnectedProps } from 'react-redux';

import {
  AbsoluteTimeRange,
  hasLogsContextSupport,
  hasLogsContextUiSupport,
  LoadingState,
  LogRowModel,
  RawTimeRange,
  EventBus,
  SplitOpen,
  DataFrame,
  SupplementaryQueryType,
  DataQueryResponse,
  LogRowContextOptions,
  DataSourceWithLogsContextSupport,
  DataSourceApi,
  hasToggleableQueryFiltersSupport,
  DataSourceWithQueryModificationSupport,
  hasQueryModificationSupport,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Collapse } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { GetFieldLinksFn } from 'app/plugins/panel/logs/types';
import { StoreState } from 'app/types';
import { ExploreItemState } from 'app/types/explore';

import { getTimeZone } from '../../profile/state/selectors';
import {
  addResultsToCache,
  clearCache,
  loadSupplementaryQueryData,
  selectIsWaitingForData,
  setSupplementaryQueryEnabled,
} from '../state/query';
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
  scrollElement?: HTMLDivElement;
  isFilterLabelActive: (key: string, value: string, refId?: string) => Promise<boolean>;
  onClickFilterString: (value: string, refId?: string) => void;
  onClickFilterOutString: (value: string, refId?: string) => void;
  onPinLineCallback?: () => void;
}

type DataSourceInstance =
  | DataSourceApi<DataQuery>
  | (DataSourceApi<DataQuery> & DataSourceWithLogsContextSupport<DataQuery>)
  | (DataSourceApi<DataQuery> & DataSourceWithQueryModificationSupport<DataQuery>);

interface LogsContainerState {
  dsInstances: Record<string, DataSourceInstance>;
}

class LogsContainer extends PureComponent<LogsContainerProps, LogsContainerState> {
  state: LogsContainerState = {
    dsInstances: {},
  };

  componentDidMount() {
    this.updateDataSourceInstances();
  }

  componentDidUpdate(prevProps: LogsContainerProps) {
    if (prevProps.logsQueries !== this.props.logsQueries) {
      this.updateDataSourceInstances();
    }
  }

  private updateDataSourceInstances() {
    const { logsQueries, datasourceInstance } = this.props;
    if (!logsQueries || !datasourceInstance) {
      return;
    }

    const dsInstances: Record<string, DataSourceInstance> = {};

    // Not in mixed mode.
    if (datasourceInstance.uid !== MIXED_DATASOURCE_NAME) {
      logsQueries.forEach(({ refId }) => {
        dsInstances[refId] = datasourceInstance;
      });
      this.setState({ dsInstances });
      return;
    }

    // Mixed mode.
    const dsPromises: Array<Promise<{ ds: DataSourceApi; refId: string }>> = [];
    for (const query of logsQueries) {
      if (!query.datasource) {
        continue;
      }
      const mustCheck = !dsInstances[query.refId] || dsInstances[query.refId].uid !== query.datasource.uid;
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

    Promise.all(dsPromises).then((instances) => {
      instances.forEach(({ ds, refId }) => {
        dsInstances[refId] = ds;
      });
      this.setState({ dsInstances });
    });
  }

  onChangeTime = (absoluteRange: AbsoluteTimeRange) => {
    const { exploreId, updateTimeRange } = this.props;
    updateTimeRange({ exploreId, absoluteRange });
  };

  loadMoreLogs = (absoluteRange: AbsoluteTimeRange) => {
    const { exploreId, loadMoreLogs } = this.props;
    loadMoreLogs({ exploreId, absoluteRange });
  };

  private getQuery(
    logsQueries: DataQuery[] | undefined,
    row: LogRowModel,
    datasourceInstance: DataSourceApi<DataQuery> & DataSourceWithLogsContextSupport<DataQuery>
  ) {
    // we need to find the query, and we need to be very sure that it's a query
    // from this datasource
    return (logsQueries ?? []).find(
      (q) => q.refId === row.dataFrame.refId && q.datasource != null && q.datasource.type === datasourceInstance.type
    );
  }

  getLogRowContext = async (
    row: LogRowModel,
    origRow: LogRowModel,
    options: LogRowContextOptions
  ): Promise<DataQueryResponse> => {
    const { logsQueries } = this.props;

    if (!origRow.dataFrame.refId || !this.state.dsInstances[origRow.dataFrame.refId]) {
      return Promise.resolve({
        data: [],
      });
    }

    const ds = this.state.dsInstances[origRow.dataFrame.refId];
    if (!hasLogsContextSupport(ds)) {
      return Promise.resolve({
        data: [],
      });
    }

    const query = this.getQuery(logsQueries, origRow, ds);
    return query
      ? ds.getLogRowContext(row, options, query)
      : Promise.resolve({
          data: [],
        });
  };

  getLogRowContextQuery = async (
    row: LogRowModel,
    options?: LogRowContextOptions,
    cacheFilters = true
  ): Promise<DataQuery | null> => {
    const { logsQueries } = this.props;

    if (!row.dataFrame.refId || !this.state.dsInstances[row.dataFrame.refId]) {
      return Promise.resolve(null);
    }

    const ds = this.state.dsInstances[row.dataFrame.refId];
    if (!hasLogsContextSupport(ds)) {
      return Promise.resolve(null);
    }

    const query = this.getQuery(logsQueries, row, ds);
    return query && ds.getLogRowContextQuery
      ? ds.getLogRowContextQuery(row, options, query, cacheFilters)
      : Promise.resolve(null);
  };

  getLogRowContextUi = (row: LogRowModel, runContextQuery?: () => void): React.ReactNode => {
    const { logsQueries } = this.props;

    if (!row.dataFrame.refId || !this.state.dsInstances[row.dataFrame.refId]) {
      return <></>;
    }

    const ds = this.state.dsInstances[row.dataFrame.refId];
    if (!hasLogsContextSupport(ds)) {
      return <></>;
    }

    const query = this.getQuery(logsQueries, row, ds);
    return query && hasLogsContextUiSupport(ds) && ds.getLogRowContextUi ? (
      ds.getLogRowContextUi(row, runContextQuery, query)
    ) : (
      <></>
    );
  };

  showContextToggle = (row?: LogRowModel): boolean => {
    if (!row?.dataFrame.refId || !this.state.dsInstances[row.dataFrame.refId]) {
      return false;
    }
    return hasLogsContextSupport(this.state.dsInstances[row.dataFrame.refId]);
  };

  getFieldLinks: GetFieldLinksFn = (field, rowIndex, dataFrame, vars) => {
    const { splitOpenFn, range } = this.props;
    return getFieldLinksForExplore({ field, rowIndex, splitOpenFn, range, dataFrame, vars });
  };

  logDetailsFilterAvailable = () => {
    return Object.values(this.state.dsInstances).some(
      (ds) => ds?.modifyQuery || hasQueryModificationSupport(ds) || hasToggleableQueryFiltersSupport(ds)
    );
  };

  filterValueAvailable = () => {
    return Object.values(this.state.dsInstances).some(
      (ds) => hasQueryModificationSupport(ds) && ds?.getSupportedQueryModifications().includes('ADD_STRING_FILTER')
    );
  };

  filterOutValueAvailable = () => {
    return Object.values(this.state.dsInstances).some(
      (ds) => hasQueryModificationSupport(ds) && ds?.getSupportedQueryModifications().includes('ADD_STRING_FILTER_OUT')
    );
  };

  addResultsToCache = () => {
    this.props.addResultsToCache(this.props.exploreId);
  };

  clearCache = () => {
    this.props.clearCache(this.props.exploreId);
  };

  loadLogsVolumeData = () => {
    this.props.loadSupplementaryQueryData(this.props.exploreId, SupplementaryQueryType.LogsVolume);
  };

  onSetLogsVolumeEnabled = (enabled: boolean) => {
    this.props.setSupplementaryQueryEnabled(this.props.exploreId, enabled, SupplementaryQueryType.LogsVolume);
  };

  render() {
    const {
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
      exploreId,
      logsVolume,
      scrollElement,
      onPinLineCallback,
    } = this.props;

    if (!logRows) {
      return null;
    }

    return (
      <>
        <LogsCrossFadeTransition visible={isLive}>
          <Collapse label={t('explore.logs-container.label-logs', 'Logs')} loading={false} isOpen>
            <LiveTailControls exploreId={exploreId}>
              {(controls) => (
                <LiveLogsWithTheme
                  logRows={logRows}
                  timeZone={timeZone}
                  stopLive={controls.stop}
                  isPaused={this.props.isPaused}
                  onPause={controls.pause}
                  onResume={controls.resume}
                  onClear={controls.clear}
                  clearedAtIndex={this.props.clearedAtIndex}
                />
              )}
            </LiveTailControls>
          </Collapse>
        </LogsCrossFadeTransition>
        <LogsCrossFadeTransition visible={!isLive}>
          <Logs
            exploreId={exploreId}
            datasourceType={this.props.datasourceInstance?.type}
            logRows={logRows}
            logsMeta={logsMeta}
            logsSeries={logsSeries}
            logsVolumeEnabled={logsVolume.enabled}
            onSetLogsVolumeEnabled={this.onSetLogsVolumeEnabled}
            logsVolumeData={logsVolume.data}
            logsQueries={logsQueries}
            width={width}
            splitOpen={splitOpenFn}
            loading={loading}
            loadingState={loadingState}
            loadLogsVolumeData={this.loadLogsVolumeData}
            onChangeTime={this.onChangeTime}
            loadMoreLogs={this.loadMoreLogs}
            onClickFilterLabel={this.logDetailsFilterAvailable() ? onClickFilterLabel : undefined}
            onClickFilterOutLabel={this.logDetailsFilterAvailable() ? onClickFilterOutLabel : undefined}
            onStartScanning={onStartScanning}
            onStopScanning={onStopScanning}
            absoluteRange={absoluteRange}
            visibleRange={visibleRange}
            timeZone={timeZone}
            scanning={scanning}
            scanRange={range.raw}
            showContextToggle={this.showContextToggle}
            getRowContext={this.getLogRowContext}
            getRowContextQuery={this.getLogRowContextQuery}
            getLogRowContextUi={this.getLogRowContextUi}
            getFieldLinks={this.getFieldLinks}
            addResultsToCache={this.addResultsToCache}
            clearCache={this.clearCache}
            eventBus={this.props.eventBus}
            panelState={this.props.panelState}
            logsFrames={this.props.logsFrames}
            scrollElement={scrollElement}
            isFilterLabelActive={this.logDetailsFilterAvailable() ? this.props.isFilterLabelActive : undefined}
            range={range}
            onPinLineCallback={onPinLineCallback}
            onClickFilterString={this.filterValueAvailable() ? this.props.onClickFilterString : undefined}
            onClickFilterOutString={this.filterOutValueAvailable() ? this.props.onClickFilterOutString : undefined}
          />
        </LogsCrossFadeTransition>
      </>
    );
  }
}

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
  addResultsToCache,
  clearCache,
  loadSupplementaryQueryData,
  setSupplementaryQueryEnabled,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(LogsContainer);
