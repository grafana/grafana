import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import {
  AbsoluteTimeRange,
  Field,
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
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Collapse } from '@grafana/ui';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
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
import { updateTimeRange } from '../state/time';
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
  onClickFilterLabel: (key: string, value: string, refId?: string) => void;
  onClickFilterOutLabel: (key: string, value: string, refId?: string) => void;
  onStartScanning: () => void;
  onStopScanning: () => void;
  eventBus: EventBus;
  splitOpenFn: SplitOpen;
  scrollElement?: HTMLDivElement;
  isFilterLabelActive: (key: string, value: string, refId?: string) => Promise<boolean>;
}

interface LogsContainerState {
  logDetailsFilterAvailable: boolean;
  /**
   * LogContext support for mixed data sources.
   * @alpha
   */
  logContextSupport: Record<string, DataSourceApi<DataQuery> & DataSourceWithLogsContextSupport<DataQuery>>;
}

class LogsContainer extends PureComponent<LogsContainerProps, LogsContainerState> {
  state: LogsContainerState = {
    logDetailsFilterAvailable: false,
    logContextSupport: {},
  };

  componentDidMount() {
    this.checkDataSourcesFeatures();
  }

  componentDidUpdate(prevProps: LogsContainerProps) {
    this.checkDataSourcesFeatures();
  }

  private checkDataSourcesFeatures() {
    const { logsQueries, datasourceInstance } = this.props;

    if (!logsQueries || !datasourceInstance) {
      return;
    }

    let newState: LogsContainerState = { ...this.state, logDetailsFilterAvailable: false };

    // Not in mixed mode.
    if (datasourceInstance.name !== MIXED_DATASOURCE_NAME) {
      if (datasourceInstance?.modifyQuery || hasToggleableQueryFiltersSupport(datasourceInstance)) {
        newState.logDetailsFilterAvailable = true;
      }
      if (hasLogsContextSupport(datasourceInstance)) {
        logsQueries.forEach(({ refId }) => {
          newState.logContextSupport[refId] = datasourceInstance;
        });
      }
      this.setState(newState);
      return;
    }

    // Mixed mode.
    const promises = [];
    const refIds: string[] = [];
    for (const query of logsQueries) {
      if (query.datasource && !newState.logContextSupport[query.refId]) {
        promises.push(getDataSourceSrv().get(query.datasource));
        refIds.push(query.refId);
      }
    }

    Promise.all(promises).then((dataSources) => {
      newState.logDetailsFilterAvailable = dataSources.some(
        (ds) => ds.modifyQuery || hasToggleableQueryFiltersSupport(ds)
      );
      dataSources.forEach((ds, i) => {
        if (hasLogsContextSupport(ds)) {
          newState.logContextSupport[refIds[i]] = ds;
        }
      });

      this.setState(newState);
    });
  }

  onChangeTime = (absoluteRange: AbsoluteTimeRange) => {
    const { exploreId, updateTimeRange } = this.props;
    updateTimeRange({ exploreId, absoluteRange });
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
  ): Promise<DataQueryResponse | []> => {
    const { logsQueries } = this.props;

    if (!origRow.dataFrame.refId || !this.state.logContextSupport[origRow.dataFrame.refId]) {
      return Promise.resolve([]);
    }

    const ds = this.state.logContextSupport[origRow.dataFrame.refId];
    const query = this.getQuery(logsQueries, origRow, ds);

    return query ? ds.getLogRowContext(row, options, query) : Promise.resolve([]);
  };

  getLogRowContextQuery = async (row: LogRowModel, options?: LogRowContextOptions): Promise<DataQuery | null> => {
    const { logsQueries } = this.props;

    if (!row.dataFrame.refId || !this.state.logContextSupport[row.dataFrame.refId]) {
      return Promise.resolve(null);
    }

    const ds = this.state.logContextSupport[row.dataFrame.refId];
    const query = this.getQuery(logsQueries, row, ds);

    return query && ds.getLogRowContextQuery ? ds.getLogRowContextQuery(row, options, query) : Promise.resolve(null);
  };

  getLogRowContextUi = (row: LogRowModel, runContextQuery?: () => void): React.ReactNode => {
    const { logsQueries } = this.props;

    if (!row.dataFrame.refId || !this.state.logContextSupport[row.dataFrame.refId]) {
      return <></>;
    }

    const ds = this.state.logContextSupport[row.dataFrame.refId];
    const query = this.getQuery(logsQueries, row, ds);

    return query && hasLogsContextUiSupport(ds) && ds.getLogRowContextUi ? ds.getLogRowContextUi(row, runContextQuery, query) : <></>;
  };

  showContextToggle = (row?: LogRowModel): boolean => {
    if (!row || !row.dataFrame.refId || !this.state.logContextSupport[row.dataFrame.refId]) {
      return false;
    }

    const ds = this.state.logContextSupport[row.dataFrame.refId];
    return ds.showContextToggle(row);
  };

  getFieldLinks = (field: Field, rowIndex: number, dataFrame: DataFrame) => {
    const { splitOpenFn, range } = this.props;
    return getFieldLinksForExplore({ field, rowIndex, splitOpenFn, range, dataFrame });
  };

  render() {
    const {
      loading,
      loadingState,
      logRows,
      logsMeta,
      logsSeries,
      logsQueries,
      loadSupplementaryQueryData,
      setSupplementaryQueryEnabled,
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
      addResultsToCache,
      clearCache,
      logsVolume,
      scrollElement,
    } = this.props;
    const { logDetailsFilterAvailable } = this.state;

    if (!logRows) {
      return null;
    }

    return (
      <>
        <LogsCrossFadeTransition visible={isLive}>
          <Collapse label="Logs" loading={false} isOpen>
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
            onSetLogsVolumeEnabled={(enabled) =>
              setSupplementaryQueryEnabled(exploreId, enabled, SupplementaryQueryType.LogsVolume)
            }
            logsVolumeData={logsVolume.data}
            logsQueries={logsQueries}
            width={width}
            splitOpen={splitOpenFn}
            loading={loading}
            loadingState={loadingState}
            loadLogsVolumeData={() => loadSupplementaryQueryData(exploreId, SupplementaryQueryType.LogsVolume)}
            onChangeTime={this.onChangeTime}
            onClickFilterLabel={logDetailsFilterAvailable ? onClickFilterLabel : undefined}
            onClickFilterOutLabel={logDetailsFilterAvailable ? onClickFilterOutLabel : undefined}
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
            addResultsToCache={() => addResultsToCache(exploreId)}
            clearCache={() => clearCache(exploreId)}
            eventBus={this.props.eventBus}
            panelState={this.props.panelState}
            logsFrames={this.props.logsFrames}
            scrollElement={scrollElement}
            isFilterLabelActive={logDetailsFilterAvailable ? this.props.isFilterLabelActive : undefined}
            range={range}
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
  addResultsToCache,
  clearCache,
  loadSupplementaryQueryData,
  setSupplementaryQueryEnabled,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(LogsContainer);
