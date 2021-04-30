import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect, ConnectedProps } from 'react-redux';
import { Collapse } from '@grafana/ui';

import { AbsoluteTimeRange, Field, LogRowModel, RawTimeRange } from '@grafana/data';

import { ExploreId, ExploreItemState } from 'app/types/explore';
import { StoreState } from 'app/types';

import { splitOpen } from './state/main';
import { updateTimeRange } from './state/time';
import { getTimeZone } from '../profile/state/selectors';
import { LiveLogsWithTheme } from './LiveLogs';
import { Logs } from './Logs';
import { LogsCrossFadeTransition } from './utils/LogsCrossFadeTransition';
import { LiveTailControls } from './useLiveTailControls';
import { getFieldLinksForExplore } from './utils/links';

interface LogsContainerProps {
  exploreId: ExploreId;
  scanRange?: RawTimeRange;
  width: number;
  syncedTimes: boolean;
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
  onStartScanning: () => void;
  onStopScanning: () => void;
}

export class LogsContainer extends PureComponent<PropsFromRedux & LogsContainerProps> {
  onChangeTime = (absoluteRange: AbsoluteTimeRange) => {
    const { exploreId, updateTimeRange } = this.props;
    updateTimeRange({ exploreId, absoluteRange });
  };

  getLogRowContext = async (row: LogRowModel, options?: any): Promise<any> => {
    const { datasourceInstance } = this.props;

    if (datasourceInstance?.getLogRowContext) {
      return datasourceInstance.getLogRowContext(row, options);
    }

    return [];
  };

  showContextToggle = (row?: LogRowModel): boolean => {
    const { datasourceInstance } = this.props;

    if (datasourceInstance?.showContextToggle) {
      return datasourceInstance.showContextToggle(row);
    }

    return false;
  };

  getFieldLinks = (field: Field, rowIndex: number) => {
    const { splitOpen: splitOpenFn, range } = this.props;
    return getFieldLinksForExplore({ field, rowIndex, splitOpenFn, range });
  };

  render() {
    const {
      loading,
      logsHighlighterExpressions,
      logRows,
      logsMeta,
      logsSeries,
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
      isLive,
      exploreId,
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
          <Collapse label="Logs" loading={loading} isOpen>
            <Logs
              logRows={logRows}
              logsMeta={logsMeta}
              logsSeries={logsSeries}
              highlighterExpressions={logsHighlighterExpressions}
              loading={loading}
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
              width={width}
              getRowContext={this.getLogRowContext}
              getFieldLinks={this.getFieldLinks}
            />
          </Collapse>
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
    logsHighlighterExpressions,
    logsResult,
    loading,
    scanning,
    datasourceInstance,
    isLive,
    isPaused,
    range,
    absoluteRange,
  } = item;
  const timeZone = getTimeZone(state.user);

  return {
    loading,
    logsHighlighterExpressions,
    logRows: logsResult?.rows,
    logsMeta: logsResult?.meta,
    logsSeries: logsResult?.series,
    visibleRange: logsResult?.visibleRange,
    scanning,
    timeZone,
    datasourceInstance,
    isLive,
    isPaused,
    range,
    absoluteRange,
  };
}

const mapDispatchToProps = {
  updateTimeRange,
  splitOpen,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

export default hot(module)(connector(LogsContainer));
