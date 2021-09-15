import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { css } from 'emotion';
import { Collapse } from '@grafana/ui';
import { AbsoluteTimeRange, Field, LogRowModel, RelatedDataType, RawTimeRange } from '@grafana/data';
import store from 'app/core/store';
import { ExploreId, ExploreItemState } from 'app/types/explore';
import { StoreState } from 'app/types';
import { splitOpen } from './state/main';
import { addResultsToCache, clearCache, changeAutoLogsVolume } from './state/query';
import { updateTimeRange } from './state/time';
import { getTimeZone } from '../profile/state/selectors';
import { LiveLogsWithTheme } from './LiveLogs';
import { Logs } from './Logs';
import { LogsCrossFadeTransition } from './utils/LogsCrossFadeTransition';
import { LiveTailControls } from './useLiveTailControls';
import { getFieldLinksForExplore } from './utils/links';
import { AUTO_LOAD_LOGS_VOLUME_SETTING_KEY } from './ExplorePaneContainer';

interface LogsContainerProps extends PropsFromRedux {
  width: number;
  exploreId: ExploreId;
  scanRange?: RawTimeRange;
  syncedTimes: boolean;
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
  onStartScanning: () => void;
  onStopScanning: () => void;
}

export class LogsContainer extends PureComponent<LogsContainerProps> {
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
      logRows,
      logsMeta,
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
      isLive,
      exploreId,
      addResultsToCache,
      clearCache,
      autoLoadLogsVolume,
      changeAutoLogsVolume,
      loadingLogsVolumeAvailable,
    } = this.props;

    if (!logRows) {
      return null;
    }

    // We need to override css overflow of divs in Collapse element to enable sticky Logs navigation
    const styleOverridesForStickyNavigation = css`
      & > div {
        overflow: visible;
        & > div {
          overflow: visible;
        }
      }
    `;

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
          <Collapse label="Logs" loading={loading} isOpen className={styleOverridesForStickyNavigation}>
            <Logs
              logRows={logRows}
              logsMeta={logsMeta}
              logsQueries={logsQueries}
              width={width}
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
              getRowContext={this.getLogRowContext}
              getFieldLinks={this.getFieldLinks}
              addResultsToCache={() => addResultsToCache(exploreId)}
              clearCache={() => clearCache(exploreId)}
              autoLoadLogsVolume={autoLoadLogsVolume}
              onChangeAutoLogsVolume={(autoLoadLogsVolume) => {
                changeAutoLogsVolume(exploreId, autoLoadLogsVolume);
                store.set(AUTO_LOAD_LOGS_VOLUME_SETTING_KEY, autoLoadLogsVolume);
              }}
              loadingLogsVolumeAvailable={loadingLogsVolumeAvailable}
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
    logsResult,
    loading,
    scanning,
    datasourceInstance,
    isLive,
    isPaused,
    range,
    absoluteRange,
    autoLoadLogsVolume,
    relatedDataProviders,
  } = item;
  const timeZone = getTimeZone(state.user);

  return {
    loading,
    logRows: logsResult?.rows,
    logsMeta: logsResult?.meta,
    logsQueries: logsResult?.queries,
    visibleRange: logsResult?.visibleRange,
    loadingLogsVolumeAvailable: !!relatedDataProviders[RelatedDataType.LogsVolume],
    scanning,
    timeZone,
    datasourceInstance,
    isLive,
    isPaused,
    range,
    absoluteRange,
    autoLoadLogsVolume,
  };
}

const mapDispatchToProps = {
  updateTimeRange,
  splitOpen,
  addResultsToCache,
  clearCache,
  changeAutoLogsVolume,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(LogsContainer);
