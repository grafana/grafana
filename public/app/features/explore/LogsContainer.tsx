import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import {
  AbsoluteTimeRange,
  Field,
  hasLogsContextSupport,
  LoadingState,
  LogRowModel,
  RawTimeRange,
  EventBus,
  SplitOpen,
  DataFrame,
} from '@grafana/data';
import { Collapse } from '@grafana/ui';
import { StoreState } from 'app/types';
import { ExploreId, ExploreItemState } from 'app/types/explore';

import { getTimeZone } from '../profile/state/selectors';

import { LiveLogsWithTheme } from './LiveLogs';
import { Logs } from './Logs';
import { addResultsToCache, clearCache, loadLogsVolumeData, setLogsVolumeEnabled } from './state/query';
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
  scrollElement?: HTMLDivElement;
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
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

  getLogRowContext = async (row: LogRowModel, options?: any): Promise<any> => {
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
      logsVolumeData,
      loadLogsVolumeData,
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
            logsVolumeEnabled={this.props.logsVolumeEnabled}
            onSetLogsVolumeEnabled={(enabled) => this.props.setLogsVolumeEnabled(exploreId, enabled)}
            logsVolumeData={logsVolumeData}
            logsQueries={logsQueries}
            width={width}
            splitOpen={splitOpenFn}
            loading={loading}
            loadingState={loadingState}
            loadLogsVolumeData={loadLogsVolumeData}
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
            getFieldLinks={this.getFieldLinks}
            addResultsToCache={() => addResultsToCache(exploreId)}
            clearCache={() => clearCache(exploreId)}
            scrollElement={scrollElement}
            eventBus={this.props.eventBus}
          />
        </LogsCrossFadeTransition>
      </>
    );
  }
}

function mapStateToProps(state: StoreState, { exploreId }: { exploreId: string }) {
  const explore = state.explore;
  // @ts-ignore
  const item: ExploreItemState = explore[exploreId];
  const {
    logsResult,
    loading,
    scanning,
    datasourceInstance,
    isLive,
    isPaused,
    range,
    absoluteRange,
    logsVolumeEnabled,
    logsVolumeDataProvider,
    logsVolumeData,
  } = item;
  const timeZone = getTimeZone(state.user);

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
    logsVolumeEnabled,
    logsVolumeDataProvider,
    logsVolumeData,
  };
}

const mapDispatchToProps = {
  updateTimeRange,
  addResultsToCache,
  clearCache,
  loadLogsVolumeData,
  setLogsVolumeEnabled,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(LogsContainer);
