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
} from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { Collapse } from '@grafana/ui';
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
  onClickFilterLabel: (key: string, value: string) => void;
  onClickFilterOutLabel: (key: string, value: string) => void;
  onStartScanning: () => void;
  onStopScanning: () => void;
  eventBus: EventBus;
  splitOpenFn: SplitOpen;
  scrollElement?: HTMLDivElement;
}

class LogsContainer extends PureComponent<LogsContainerProps> {
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
    const { datasourceInstance, logsQueries } = this.props;

    if (hasLogsContextSupport(datasourceInstance)) {
      const query = this.getQuery(logsQueries, origRow, datasourceInstance);
      return datasourceInstance.getLogRowContext(row, options, query);
    }

    return [];
  };

  getLogRowContextQuery = async (row: LogRowModel, options?: LogRowContextOptions): Promise<DataQuery | null> => {
    const { datasourceInstance, logsQueries } = this.props;

    if (hasLogsContextSupport(datasourceInstance) && datasourceInstance.getLogRowContextQuery) {
      const query = this.getQuery(logsQueries, row, datasourceInstance);
      return datasourceInstance.getLogRowContextQuery(row, options, query);
    }

    return null;
  };

  getLogRowContextUi = (row: LogRowModel, runContextQuery?: () => void): React.ReactNode => {
    const { datasourceInstance, logsQueries } = this.props;

    if (hasLogsContextUiSupport(datasourceInstance) && datasourceInstance.getLogRowContextUi) {
      const query = this.getQuery(logsQueries, row, datasourceInstance);
      return datasourceInstance.getLogRowContextUi(row, runContextQuery, query);
    }

    return <></>;
  };

  showContextToggle = (row?: LogRowModel): boolean => {
    const { datasourceInstance } = this.props;

    if (hasLogsContextSupport(datasourceInstance)) {
      return datasourceInstance.showContextToggle(row);
    }

    return false;
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
            onClickFilterLabel={onClickFilterLabel}
            onClickFilterOutLabel={onClickFilterOutLabel}
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
            scrollElement={scrollElement}
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
