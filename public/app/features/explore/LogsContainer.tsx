import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { cx, css } from 'emotion';
import { Collapse, Table, Field as FormField, RadioButtonGroup } from '@grafana/ui';

import {
  AbsoluteTimeRange,
  DataFrame,
  DataSourceApi,
  Field,
  GraphSeriesXY,
  LogRowModel,
  LogsDedupStrategy,
  LogsMetaItem,
  RawTimeRange,
  TimeRange,
  TimeZone,
} from '@grafana/data';

import { ExploreId, ExploreItemState } from 'app/types/explore';
import { StoreState } from 'app/types';
import store from 'app/core/store';

import { changeDedupStrategy, updateTimeRange, splitOpen } from './state/actions';
import { toggleLogLevelAction } from 'app/features/explore/state/actionTypes';
import { deduplicatedRowsSelector } from 'app/features/explore/state/selectors';
import { getTimeZone } from '../profile/state/selectors';
import { LiveLogsWithTheme } from './LiveLogs';
import { Logs } from './Logs';
import { LogsCrossFadeTransition } from './utils/LogsCrossFadeTransition';
import { LogsControls, fieldClass } from './LogsControls';
import { LiveTailControls } from './useLiveTailControls';
import { getFieldLinksForExplore } from './utils/links';

enum DisplayFormat {
  Logs = 'Logs',
  Table = 'Table',
}

interface LogsContainerProps {
  datasourceInstance?: DataSourceApi;
  exploreId: ExploreId;
  loading: boolean;

  logsHighlighterExpressions?: string[];
  logRows?: LogRowModel[];
  logsMeta?: LogsMetaItem[];
  logsSeries?: GraphSeriesXY[];
  tableResult?: DataFrame;
  dedupedRows?: LogRowModel[];
  visibleRange?: AbsoluteTimeRange;

  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
  onStartScanning: () => void;
  onStopScanning: () => void;
  onClickCell: (key: string, value: string) => void;
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
  allowFormattingAsTable?: boolean;
}

interface LogsContainerState {
  displayFormat: DisplayFormat;
  showLabels: boolean;
  showTime: boolean;
  wrapLogMessage: boolean;
}

const SETTINGS_KEYS = {
  showLabels: 'grafana.explore.logs.showLabels',
  showTime: 'grafana.explore.logs.showTime',
  wrapLogMessage: 'grafana.explore.logs.wrapLogMessage',
  displayFormat: 'grafana.explore.logs.displayFormat',
};

const marginRightZero = css`
  margin-right: 0px;
  margin-left: auto;
`;

export class LogsContainer extends PureComponent<LogsContainerProps, LogsContainerState> {
  state = {
    showLabels: store.getBool(SETTINGS_KEYS.showLabels, false),
    showTime: store.getBool(SETTINGS_KEYS.showTime, true),
    wrapLogMessage: store.getBool(SETTINGS_KEYS.wrapLogMessage, true),
    displayFormat: store.get(SETTINGS_KEYS.displayFormat) ?? DisplayFormat.Logs,
  };

  onChangeFormat = (displayFormat: DisplayFormat) => {
    this.setState({
      displayFormat,
    });

    store.set(SETTINGS_KEYS.displayFormat, displayFormat);
  };

  handleDedupStrategyChange = (dedupStrategy: LogsDedupStrategy) => {
    return this.props.changeDedupStrategy(this.props.exploreId, dedupStrategy);
  };

  handleLabelsChange = (showLabels: boolean) => {
    this.setState({
      showLabels,
    });
    store.set(SETTINGS_KEYS.showLabels, showLabels);
  };

  handleTimeChange = (showTime: boolean) => {
    this.setState({
      showTime,
    });
    store.set(SETTINGS_KEYS.showTime, showTime);
  };

  handleWrapLogMessageChange = (wrapLogMessage: boolean) => {
    this.setState({
      wrapLogMessage,
    });
    store.set(SETTINGS_KEYS.wrapLogMessage, wrapLogMessage);
  };

  getLogRowContext = async (row: LogRowModel, options?: any): Promise<any> => {
    const { datasourceInstance } = this.props;

    if (datasourceInstance?.getLogRowContext) {
      return datasourceInstance.getLogRowContext(row, options);
    }

    return [];
  };

  getFieldLinks = (field: Field, rowIndex: number) => {
    return getFieldLinksForExplore(field, rowIndex, this.props.splitOpen, this.props.range);
  };

  getTableHeight() {
    const { tableResult } = this.props;

    if (!tableResult || tableResult.length === 0) {
      return 200;
    }

    // tries to estimate table height
    return Math.max(Math.min(600, tableResult.length * 35) + 35);
  }

  render() {
    const {
      loading,
      logsHighlighterExpressions,
      logRows,
      logsMeta,
      logsSeries,
      tableResult,
      dedupedRows,
      onClickFilterLabel,
      onClickCell,
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
      dedupStrategy,
      allowFormattingAsTable = true,
    } = this.props;

    const { displayFormat, showLabels, showTime, wrapLogMessage } = this.state;

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
          <Collapse label="Results" loading={loading} isOpen>
            <div className="logs-panel">
              <div className="results-panel-options">
                <div className="results-panel-controls">
                  {displayFormat === DisplayFormat.Logs && (
                    <LogsControls
                      logRows={logRows}
                      showLabels={showLabels}
                      showTime={showTime}
                      wrapLogMessage={wrapLogMessage}
                      dedupStrategy={dedupStrategy}
                      onLabelsChange={this.handleLabelsChange}
                      onTimeChange={this.handleTimeChange}
                      onWrapLogMessageChange={this.handleWrapLogMessageChange}
                      onDedupStrategyChange={this.handleDedupStrategyChange}
                    />
                  )}
                  {allowFormattingAsTable && (
                    <FormField label="Format as" horizontal className={cx(fieldClass, marginRightZero)}>
                      <RadioButtonGroup
                        options={[
                          {
                            label: DisplayFormat.Logs,
                            value: DisplayFormat.Logs,
                          },
                          {
                            label: DisplayFormat.Table,
                            value: DisplayFormat.Table,
                          },
                        ]}
                        value={displayFormat}
                        onChange={this.onChangeFormat}
                      />
                    </FormField>
                  )}
                </div>
              </div>
              {!allowFormattingAsTable || displayFormat === DisplayFormat.Logs ? (
                <Logs
                  dedupStrategy={this.props.dedupStrategy || LogsDedupStrategy.none}
                  wrapLogMessage={wrapLogMessage}
                  logRows={logRows}
                  logsMeta={logsMeta}
                  logsSeries={logsSeries}
                  dedupedRows={dedupedRows}
                  highlighterExpressions={logsHighlighterExpressions}
                  loading={loading}
                  showTime={showTime}
                  showLabels={showLabels}
                  onClickFilterLabel={onClickFilterLabel}
                  onClickFilterOutLabel={onClickFilterOutLabel}
                  onStartScanning={onStartScanning}
                  onStopScanning={onStopScanning}
                  absoluteRange={absoluteRange}
                  visibleRange={visibleRange}
                  timeZone={timeZone}
                  scanning={scanning}
                  scanRange={range.raw}
                  width={width}
                  getRowContext={this.getLogRowContext}
                  getFieldLinks={this.getFieldLinks}
                />
              ) : (
                tableResult && (
                  <Table data={tableResult} width={width} height={this.getTableHeight()} onCellClick={onClickCell} />
                )
              )}
            </div>
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
    tableResult,
    loading,
    scanning,
    datasourceInstance,
    isLive,
    isPaused,
    range,
    absoluteRange,
    dedupStrategy,
  } = item;
  const dedupedRows = deduplicatedRowsSelector(item);
  const timeZone = getTimeZone(state.user);

  return {
    loading,
    logsHighlighterExpressions,
    logRows: logsResult && logsResult.rows,
    logsMeta: logsResult && logsResult.meta,
    logsSeries: logsResult && logsResult.series,
    visibleRange: logsResult && logsResult.visibleRange,
    tableResult,
    scanning,
    timeZone,
    dedupStrategy,
    dedupedRows,
    datasourceInstance,
    isLive,
    isPaused,
    range,
    absoluteRange,
  };
}

const mapDispatchToProps = {
  changeDedupStrategy,
  toggleLogLevelAction,
  updateTimeRange,
  splitOpen,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(LogsContainer));
