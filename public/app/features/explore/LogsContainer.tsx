import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { Collapse } from '@grafana/ui';

import {
  DataSourceApi,
  RawTimeRange,
  LogLevel,
  TimeZone,
  AbsoluteTimeRange,
  LogRowModel,
  LogsDedupStrategy,
  TimeRange,
  LogsMetaItem,
  GraphSeriesXY,
  Field,
} from '@grafana/data';

import { ExploreId, ExploreItemState } from 'app/types/explore';
import { StoreState, QueryDirection } from 'app/types';

import { changeDedupStrategy, updateTimeRange, splitOpen, runAppendQueries } from './state/actions';
import { toggleLogLevelAction } from 'app/features/explore/state/actionTypes';
import { deduplicatedRowsSelector } from 'app/features/explore/state/selectors';
import { getTimeZone } from '../profile/state/selectors';
import { LiveLogsWithTheme } from './LiveLogs';
import { Logs } from './Logs';
import { LogsCrossFadeTransition } from './utils/LogsCrossFadeTransition';
import { LiveTailControls } from './useLiveTailControls';
import { getLinksFromLogsField } from '../panel/panellinks/linkSuppliers';

interface LogsContainerProps {
  datasourceInstance?: DataSourceApi;
  exploreId: ExploreId;
  loading: boolean;

  logsHighlighterExpressions?: string[];
  logRows?: LogRowModel[];
  logsMeta?: LogsMetaItem[];
  logsSeries?: GraphSeriesXY[];
  dedupedRows?: LogRowModel[];

  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
  onStartScanning: () => void;
  onStopScanning: () => void;
  timeZone: TimeZone;
  scanning?: boolean;
  scanRange?: RawTimeRange;
  toggleLogLevelAction: typeof toggleLogLevelAction;
  changeDedupStrategy: typeof changeDedupStrategy;
  dedupStrategy: LogsDedupStrategy;
  width: number;
  isLive: boolean;
  updateTimeRange: typeof updateTimeRange;
  range: TimeRange;
  syncedTimes: boolean;
  absoluteRange: AbsoluteTimeRange;
  isPaused: boolean;
  splitOpen: typeof splitOpen;
  displayMoreLogsBtn: boolean;
  runAppendQueries: typeof runAppendQueries;
  hasNewerLogsRanges: boolean;
}

export class LogsContainer extends PureComponent<LogsContainerProps> {
  onChangeTime = (absoluteRange: AbsoluteTimeRange) => {
    const { exploreId, updateTimeRange } = this.props;
    updateTimeRange({ exploreId, absoluteRange });
  };

  handleDedupStrategyChange = (dedupStrategy: LogsDedupStrategy) => {
    this.props.changeDedupStrategy(this.props.exploreId, dedupStrategy);
  };

  handleToggleLogLevel = (hiddenLogLevels: LogLevel[]) => {
    const { exploreId } = this.props;
    this.props.toggleLogLevelAction({
      exploreId,
      hiddenLogLevels,
    });
  };

  getLogRowContext = async (row: LogRowModel, options?: any): Promise<any> => {
    const { datasourceInstance } = this.props;

    if (datasourceInstance?.getLogRowContext) {
      return datasourceInstance.getLogRowContext(row, options);
    }

    return [];
  };

  /**
   * Get links from the filed of a dataframe that was given to as and in addition check if there is associated
   * metadata with datasource in which case we will add onClick to open the link in new split window. This assumes
   * that we just supply datasource name and field value and Explore split window will know how to render that
   * appropriately. This is for example used for transition from log with traceId to trace datasource to show that
   * trace.
   * @param field
   * @param rowIndex
   */
  getFieldLinks = (field: Field, rowIndex: number) => {
    const data = getLinksFromLogsField(field, rowIndex);
    return data.map(d => {
      if (d.link.meta?.datasourceUid) {
        return {
          ...d.linkModel,
          onClick: () => {
            this.props.splitOpen({ dataSourceUid: d.link.meta.datasourceUid, query: field.values.get(rowIndex) });
          },
        };
      }
      return d.linkModel;
    });
  };

  showMoreNewerLogs = () => {
    const { exploreId, runAppendQueries } = this.props;
    runAppendQueries(exploreId, QueryDirection.forward);
  };

  showMoreOlderLogs = () => {
    const { exploreId, runAppendQueries } = this.props;
    runAppendQueries(exploreId, QueryDirection.backward);
  };

  render() {
    const {
      loading,
      logsHighlighterExpressions,
      logRows,
      logsMeta,
      logsSeries,
      dedupedRows,
      onClickFilterLabel,
      onClickFilterOutLabel,
      onStartScanning,
      onStopScanning,
      absoluteRange,
      timeZone,
      scanning,
      range,
      width,
      isLive,
      exploreId,
      displayMoreLogsBtn,
      datasourceInstance,
      hasNewerLogsRanges,
    } = this.props;

    return (
      <>
        <LogsCrossFadeTransition visible={isLive}>
          <Collapse label="Logs" loading={false} isOpen>
            <LiveTailControls exploreId={exploreId}>
              {controls => (
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
              dedupStrategy={this.props.dedupStrategy || LogsDedupStrategy.none}
              logRows={logRows}
              logsMeta={logsMeta}
              logsSeries={logsSeries}
              dedupedRows={dedupedRows}
              highlighterExpressions={logsHighlighterExpressions}
              loading={loading}
              onChangeTime={this.onChangeTime}
              onClickFilterLabel={onClickFilterLabel}
              onClickFilterOutLabel={onClickFilterOutLabel}
              onStartScanning={onStartScanning}
              onStopScanning={onStopScanning}
              onDedupStrategyChange={this.handleDedupStrategyChange}
              onToggleLogLevel={this.handleToggleLogLevel}
              absoluteRange={absoluteRange}
              timeZone={timeZone}
              scanning={scanning}
              scanRange={range.raw}
              width={width}
              getRowContext={this.getLogRowContext}
              getFieldLinks={this.getFieldLinks}
              datasourceInstance={datasourceInstance}
              displayMoreLogsBtn={displayMoreLogsBtn}
              showMoreNewerLogs={this.showMoreNewerLogs}
              showMoreOlderLogs={this.showMoreOlderLogs}
              hasNewerLogsRanges={hasNewerLogsRanges}
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
    dedupStrategy,
    queries,
    prevShowMoreLogsTimeRanges,
  } = item;
  const dedupedRows = deduplicatedRowsSelector(item);
  const timeZone = getTimeZone(state.user);

  return {
    loading,
    logsHighlighterExpressions,
    logRows: logsResult && logsResult.rows,
    logsMeta: logsResult && logsResult.meta,
    logsSeries: logsResult && logsResult.series,
    scanning,
    timeZone,
    dedupStrategy,
    dedupedRows,
    datasourceInstance,
    isLive,
    isPaused,
    range,
    absoluteRange,
    displayMoreLogsBtn: queries.filter(elem => !elem.hide).length === 1,
    hasNewerLogsRanges: prevShowMoreLogsTimeRanges.length > 0,
  };
}

const mapDispatchToProps = {
  changeDedupStrategy,
  toggleLogLevelAction,
  updateTimeRange,
  splitOpen,
  runAppendQueries,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(LogsContainer));
