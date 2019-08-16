import React, { PureComponent } from 'react';
import { LogsModel, TimeZone, LogsDedupStrategy, LogRowModel } from '@grafana/data';
import { LogRow } from './LogRow';

const PREVIEW_LIMIT = 100;

export interface Props {
  data: LogsModel;
  dedupStrategy: LogsDedupStrategy;
  highlighterExpressions: string[];
  showTime: boolean;
  showLabels: boolean;
  timeZone: TimeZone;
  deduplicatedData?: LogsModel;
  onClickLabel?: (label: string, value: string) => void;
  getRowContext?: (row: LogRowModel, options?: any) => Promise<any>;
}

interface State {
  deferLogs: boolean;
  renderAll: boolean;
}

export class LogRows extends PureComponent<Props, State> {
  deferLogsTimer: NodeJS.Timer | null = null;
  renderAllTimer: NodeJS.Timer | null = null;

  state: State = {
    deferLogs: true,
    renderAll: false,
  };

  componentDidMount() {
    // Staged rendering
    if (this.state.deferLogs) {
      const { data } = this.props;
      const rowCount = data && data.rows ? data.rows.length : 0;
      // Render all right away if not too far over the limit
      const renderAll = rowCount <= PREVIEW_LIMIT * 2;
      this.deferLogsTimer = setTimeout(() => this.setState({ deferLogs: false, renderAll }), rowCount);
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    // Staged rendering
    if (prevState.deferLogs && !this.state.deferLogs && !this.state.renderAll) {
      this.renderAllTimer = setTimeout(() => this.setState({ renderAll: true }), 2000);
    }
  }

  componentWillUnmount() {
    if (this.deferLogsTimer) {
      clearTimeout(this.deferLogsTimer);
    }

    if (this.renderAllTimer) {
      clearTimeout(this.renderAllTimer);
    }
  }

  render() {
    const {
      dedupStrategy,
      showTime,
      data,
      deduplicatedData,
      highlighterExpressions,
      showLabels,
      timeZone,
      onClickLabel,
    } = this.props;
    const { deferLogs, renderAll } = this.state;
    const dedupedData = deduplicatedData ? deduplicatedData : data;
    const hasData = data && data.rows && data.rows.length > 0;
    const hasLabel = hasData && dedupedData && dedupedData.hasUniqueLabels ? true : false;
    const dedupCount = dedupedData
      ? dedupedData.rows.reduce((sum, row) => (row.duplicates ? sum + row.duplicates : sum), 0)
      : 0;
    const showDuplicates = dedupStrategy !== LogsDedupStrategy.none && dedupCount > 0;

    // Staged rendering
    const processedRows = dedupedData ? dedupedData.rows : [];
    const firstRows = processedRows.slice(0, PREVIEW_LIMIT);
    const lastRows = processedRows.slice(PREVIEW_LIMIT);

    // React profiler becomes unusable if we pass all rows to all rows and their labels, using getter instead
    const getRows = () => processedRows;
    const getRowContext = this.props.getRowContext ? this.props.getRowContext : () => Promise.resolve([]);

    return (
      <div className="logs-rows">
        {hasData &&
        !deferLogs && // Only inject highlighterExpression in the first set for performance reasons
          firstRows.map((row, index) => (
            <LogRow
              key={index}
              getRows={getRows}
              getRowContext={getRowContext}
              highlighterExpressions={highlighterExpressions}
              row={row}
              showDuplicates={showDuplicates}
              showLabels={showLabels && hasLabel}
              showTime={showTime}
              timeZone={timeZone}
              onClickLabel={onClickLabel}
            />
          ))}
        {hasData &&
          !deferLogs &&
          renderAll &&
          lastRows.map((row, index) => (
            <LogRow
              key={PREVIEW_LIMIT + index}
              getRows={getRows}
              getRowContext={getRowContext}
              row={row}
              showDuplicates={showDuplicates}
              showLabels={showLabels && hasLabel}
              showTime={showTime}
              timeZone={timeZone}
              onClickLabel={onClickLabel}
            />
          ))}
        {hasData && deferLogs && <span>Rendering {processedRows.length} rows...</span>}
      </div>
    );
  }
}
