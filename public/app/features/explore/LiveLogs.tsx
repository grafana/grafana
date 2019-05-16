import React, { PureComponent } from 'react';
import { LogsModel, LogRowModel } from 'app/core/logs_model';
import ElapsedTime from './ElapsedTime';

export const rowSorter = (a: LogRowModel, b: LogRowModel) => a.timeEpochMs - b.timeEpochMs;

export interface Props {
  logsResult?: LogsModel;
}

export interface State {
  prevRows: LogRowModel[];
  renderCount: number;
}

export class LiveLogs extends PureComponent<Props, State> {
  private liveEndDiv: HTMLDivElement = null;

  constructor(props: Props) {
    super(props);
    this.state = { prevRows: props.logsResult ? props.logsResult.rows : [], renderCount: 0 };
  }

  componentDidUpdate(prevProps: Props) {
    const prevRows: LogRowModel[] = prevProps.logsResult ? prevProps.logsResult.rows : [];
    const rows: LogRowModel[] = this.props.logsResult ? this.props.logsResult.rows : [];

    if (prevRows !== rows) {
      this.setState({
        prevRows,
        renderCount: this.state.renderCount + 1,
      });
    }

    if (this.liveEndDiv) {
      this.liveEndDiv.scrollIntoView(false);
    }
  }

  render() {
    const { prevRows, renderCount } = this.state;
    const rows: LogRowModel[] = this.props.logsResult ? this.props.logsResult.rows : [];
    const freshRows = rows.filter(row => !prevRows.includes(row)).sort(rowSorter);
    const oldRows = prevRows.filter(row => rows.includes(row)).sort(rowSorter);

    return (
      <>
        <div className="logs-rows live">
          {oldRows.map((row, index) => {
            return (
              <div className="logs-row old" key={`${row.timeEpochMs}-${index}`}>
                <div className="logs-row__localtime" title={`${row.timestamp} (${row.timeFromNow})`}>
                  {row.timeLocal}
                </div>
                <div className="logs-row__message">{row.entry}</div>
              </div>
            );
          })}
          {freshRows.map((row, index) => {
            return (
              <div className="logs-row fresh" key={`${row.timeEpochMs}-${index}`}>
                <div className="logs-row__localtime" title={`${row.timestamp} (${row.timeFromNow})`}>
                  {row.timeLocal}
                </div>
                <div className="logs-row__message">{row.entry}</div>
              </div>
            );
          })}
          <div ref={element => (this.liveEndDiv = element)} />
        </div>
        <div className="explore-panel__loader explore-panel__loader--active" />
        <div>
          <span>
            Last line received: <ElapsedTime renderCount={renderCount} humanize={true} /> ago
          </span>
        </div>
      </>
    );
  }
}
