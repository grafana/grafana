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
} from '@grafana/data';
import { Collapse } from '@grafana/ui';
import { StoreState } from 'app/types';
import { ExploreId, ExploreItemState } from 'app/types/explore';

import { getTimeZone } from '../profile/state/selectors';

import { LiveLogsWithTheme } from './LiveLogs';
import { Logs } from './Logs';
import { addResultsToCache, clearCache, loadSupplementaryQueryData, setSupplementaryQueryEnabled } from './state/query';
import { updateTimeRange } from './state/time';
import { LiveTailControls } from './useLiveTailControls';
import { LogsCrossFadeTransition } from './utils/LogsCrossFadeTransition';
import { getFieldLinksForExplore } from './utils/links';

interface LogsContainerProps extends PropsFromRedux {
  width: number;
  exploreId: ExploreId;
  scanRange?: RawTimeRange;
  syncedTimes: boolean;
  loadingState: LoadingState;
  onClickFilterLabel: (key: string, value: string) => void;
  onClickFilterOutLabel: (key: string, value: string) => void;
  onStartScanning: () => void;
  onStopScanning: () => void;
  eventBus: EventBus;
  splitOpenFn: SplitOpen;
}

class LogsContainer extends PureComponent<LogsContainerProps> {
  onChangeTime = (absoluteRange: AbsoluteTimeRange) => {
    const { exploreId, updateTimeRange } = this.props;
    updateTimeRange({ exploreId, absoluteRange });
  };

  getLogRowContext = async (row: LogRowModel, options?: any): Promise<DataQueryResponse | []> => {
    const { datasourceInstance, logsQueries } = this.props;

    if (hasLogsContextSupport(datasourceInstance)) {
      // we need to find the query, and we need to be very sure that
      // it's a query from this datasource
      const query = (logsQueries ?? []).find(
        (q) => q.refId === row.dataFrame.refId && q.datasource != null && q.datasource.type === datasourceInstance.type
      );
      return datasourceInstance.getLogRowContext(row, options, query);
    }

    return [];
  };

  getLogRowContextUi = (row: LogRowModel, runContextQuery?: () => void): React.ReactNode => {
    const { datasourceInstance, logsQueries } = this.props;

    if (hasLogsContextUiSupport(datasourceInstance) && datasourceInstance.getLogRowContextUi) {
      const query = (logsQueries ?? []).find(
        (q) => q.refId === row.dataFrame.refId && q.datasource != null && q.datasource.type === datasourceInstance.type
      );
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
            getLogRowContextUi={this.getLogRowContextUi}
            getFieldLinks={this.getFieldLinks}
            addResultsToCache={() => addResultsToCache(exploreId)}
            clearCache={() => clearCache(exploreId)}
            eventBus={this.props.eventBus}
          />
        </LogsCrossFadeTransition>
      </>
    );
  }
}

function mapStateToProps(state: StoreState, { exploreId }: { exploreId: ExploreId }) {
  const explore = state.explore;
  const item: ExploreItemState = explore.panes[exploreId]!;
  const {
    logsResult,
    loading,
    scanning,
    datasourceInstance,
    isLive,
    isPaused,
    range,
    absoluteRange,
    supplementaryQueries,
  } = item;
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
    range,
    absoluteRange,
    logsVolume,
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
