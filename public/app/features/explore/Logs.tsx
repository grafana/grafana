import React, { PureComponent } from 'react';
import { css, cx } from 'emotion';
import { capitalize } from 'lodash';

import {
  rangeUtil,
  RawTimeRange,
  LogLevel,
  TimeZone,
  AbsoluteTimeRange,
  LogsMetaKind,
  LogsDedupStrategy,
  LogRowModel,
  LogsDedupDescription,
  LogsMetaItem,
  LogsSortOrder,
  GraphSeriesXY,
  LinkModel,
  Field,
} from '@grafana/data';
import { LegacyForms, LogLabels, ToggleButtonGroup, ToggleButton, LogRows, Button } from '@grafana/ui';
const { Switch } = LegacyForms;
import store from 'app/core/store';

import { ExploreGraphPanel } from './ExploreGraphPanel';
import { MetaInfoText } from './MetaInfoText';
import { RowContextOptions } from '@grafana/ui/src/components/Logs/LogRowContextProvider';
import { MAX_CHARACTERS } from '@grafana/ui/src/components/Logs/LogRowMessage';

const SETTINGS_KEYS = {
  showLabels: 'grafana.explore.logs.showLabels',
  showTime: 'grafana.explore.logs.showTime',
  wrapLogMessage: 'grafana.explore.logs.wrapLogMessage',
};

function renderMetaItem(value: any, kind: LogsMetaKind) {
  if (kind === LogsMetaKind.LabelsMap) {
    return (
      <span className="logs-meta-item__labels">
        <LogLabels labels={value} />
      </span>
    );
  }
  return value;
}

interface Props {
  logRows?: LogRowModel[];
  logsMeta?: LogsMetaItem[];
  logsSeries?: GraphSeriesXY[];
  dedupedRows?: LogRowModel[];
  visibleRange?: AbsoluteTimeRange;

  width: number;
  highlighterExpressions?: string[];
  loading: boolean;
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  scanning?: boolean;
  scanRange?: RawTimeRange;
  dedupStrategy: LogsDedupStrategy;
  showContextToggle?: (row?: LogRowModel) => boolean;
  onChangeTime: (range: AbsoluteTimeRange) => void;
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
  onStartScanning?: () => void;
  onStopScanning?: () => void;
  onDedupStrategyChange: (dedupStrategy: LogsDedupStrategy) => void;
  onToggleLogLevel: (hiddenLogLevels: LogLevel[]) => void;
  getRowContext?: (row: LogRowModel, options?: RowContextOptions) => Promise<any>;
  getFieldLinks: (field: Field, rowIndex: number) => Array<LinkModel<Field>>;
}

interface State {
  showLabels: boolean;
  showTime: boolean;
  wrapLogMessage: boolean;
  logsSortOrder: LogsSortOrder | null;
  isFlipping: boolean;
  showParsedFields: string[];
}

export class Logs extends PureComponent<Props, State> {
  flipOrderTimer: NodeJS.Timeout;
  cancelFlippingTimer: NodeJS.Timeout;

  state: State = {
    showLabels: store.getBool(SETTINGS_KEYS.showLabels, false),
    showTime: store.getBool(SETTINGS_KEYS.showTime, true),
    wrapLogMessage: store.getBool(SETTINGS_KEYS.wrapLogMessage, true),
    logsSortOrder: null,
    isFlipping: false,
    showParsedFields: [],
  };

  componentWillUnmount() {
    clearTimeout(this.flipOrderTimer);
    clearTimeout(this.cancelFlippingTimer);
  }

  onChangeLogsSortOrder = () => {
    this.setState({ isFlipping: true });
    // we are using setTimeout here to make sure that disabled button is rendered before the rendering of reordered logs
    this.flipOrderTimer = setTimeout(() => {
      this.setState(prevState => {
        if (prevState.logsSortOrder === null || prevState.logsSortOrder === LogsSortOrder.Descending) {
          return { logsSortOrder: LogsSortOrder.Ascending };
        }
        return { logsSortOrder: LogsSortOrder.Descending };
      });
    }, 0);
    this.cancelFlippingTimer = setTimeout(() => this.setState({ isFlipping: false }), 1000);
  };

  onChangeDedup = (dedup: LogsDedupStrategy) => {
    const { onDedupStrategyChange } = this.props;
    if (this.props.dedupStrategy === dedup) {
      return onDedupStrategyChange(LogsDedupStrategy.none);
    }
    return onDedupStrategyChange(dedup);
  };

  onChangeLabels = (event?: React.SyntheticEvent) => {
    const target = event && (event.target as HTMLInputElement);
    if (target) {
      const showLabels = target.checked;
      this.setState({
        showLabels,
      });
      store.set(SETTINGS_KEYS.showLabels, showLabels);
    }
  };

  onChangeTime = (event?: React.SyntheticEvent) => {
    const target = event && (event.target as HTMLInputElement);
    if (target) {
      const showTime = target.checked;
      this.setState({
        showTime,
      });
      store.set(SETTINGS_KEYS.showTime, showTime);
    }
  };

  onChangewrapLogMessage = (event?: React.SyntheticEvent) => {
    const target = event && (event.target as HTMLInputElement);
    if (target) {
      const wrapLogMessage = target.checked;
      this.setState({
        wrapLogMessage,
      });
      store.set(SETTINGS_KEYS.wrapLogMessage, wrapLogMessage);
    }
  };

  onToggleLogLevel = (hiddenRawLevels: string[]) => {
    const hiddenLogLevels: LogLevel[] = hiddenRawLevels.map(level => LogLevel[level as LogLevel]);
    this.props.onToggleLogLevel(hiddenLogLevels);
  };

  onClickScan = (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (this.props.onStartScanning) {
      this.props.onStartScanning();
    }
  };

  onClickStopScan = (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (this.props.onStopScanning) {
      this.props.onStopScanning();
    }
  };

  showParsedField = (key: string) => {
    const index = this.state.showParsedFields.indexOf(key);

    if (index === -1) {
      this.setState(state => {
        return {
          showParsedFields: state.showParsedFields.concat(key),
        };
      });
    }
  };

  hideParsedField = (key: string) => {
    const index = this.state.showParsedFields.indexOf(key);
    if (index > -1) {
      this.setState(state => {
        return {
          showParsedFields: state.showParsedFields.filter(k => key !== k),
        };
      });
    }
  };

  clearParsedFields = () => {
    this.setState(state => {
      return {
        showParsedFields: [],
      };
    });
  };

  render() {
    const {
      logRows,
      logsMeta,
      logsSeries,
      visibleRange,
      highlighterExpressions,
      loading = false,
      onClickFilterLabel,
      onClickFilterOutLabel,
      timeZone,
      scanning,
      scanRange,
      showContextToggle,
      width,
      dedupedRows,
      absoluteRange,
      onChangeTime,
      getFieldLinks,
    } = this.props;

    if (!logRows) {
      return null;
    }

    const { showLabels, showTime, wrapLogMessage, logsSortOrder, isFlipping, showParsedFields } = this.state;
    const { dedupStrategy } = this.props;
    const hasData = logRows && logRows.length > 0;
    const dedupCount = dedupedRows
      ? dedupedRows.reduce((sum, row) => (row.duplicates ? sum + row.duplicates : sum), 0)
      : 0;
    const meta = logsMeta ? [...logsMeta] : [];

    if (dedupStrategy !== LogsDedupStrategy.none) {
      meta.push({
        label: 'Dedup count',
        value: dedupCount,
        kind: LogsMetaKind.Number,
      });
    }

    if (logRows.some(r => r.entry.length > MAX_CHARACTERS)) {
      meta.push({
        label: 'Info',
        value: 'Logs with more than 100,000 characters could not be parsed and highlighted',
        kind: LogsMetaKind.String,
      });
    }

    const scanText = scanRange ? `Scanning ${rangeUtil.describeTimeRange(scanRange)}` : 'Scanning...';
    const series = logsSeries ? logsSeries : [];

    return (
      <div className="logs-panel">
        <div className="logs-panel-graph">
          <ExploreGraphPanel
            series={series}
            width={width}
            onHiddenSeriesChanged={this.onToggleLogLevel}
            loading={loading}
            absoluteRange={visibleRange || absoluteRange}
            isStacked={true}
            showPanel={false}
            timeZone={timeZone}
            showBars={true}
            showLines={false}
            onUpdateTimeRange={onChangeTime}
          />
        </div>
        <div className="logs-panel-options">
          <div className="logs-panel-controls">
            <div className="logs-panel-controls-main">
              <Switch label="Time" checked={showTime} onChange={this.onChangeTime} transparent />
              <Switch label="Unique labels" checked={showLabels} onChange={this.onChangeLabels} transparent />
              <Switch label="Wrap lines" checked={wrapLogMessage} onChange={this.onChangewrapLogMessage} transparent />
              <ToggleButtonGroup label="Dedup" transparent={true}>
                {Object.keys(LogsDedupStrategy).map((dedupType: string, i) => (
                  <ToggleButton
                    key={i}
                    value={dedupType}
                    onChange={this.onChangeDedup}
                    selected={dedupStrategy === dedupType}
                    // @ts-ignore
                    tooltip={LogsDedupDescription[dedupType]}
                  >
                    {capitalize(dedupType)}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </div>
            <button
              disabled={isFlipping}
              title={logsSortOrder === LogsSortOrder.Ascending ? 'Change to newest first' : 'Change to oldest first'}
              aria-label="Flip results order"
              className={cx(
                'gf-form-label gf-form-label--btn',
                css`
                  margin-top: 4px;
                `
              )}
              onClick={this.onChangeLogsSortOrder}
            >
              <span className="btn-title">{isFlipping ? 'Flipping...' : 'Flip results order'}</span>
            </button>
          </div>
        </div>

        {meta && (
          <MetaInfoText
            metaItems={meta.map(item => {
              return {
                label: item.label,
                value: renderMetaItem(item.value, item.kind),
              };
            })}
          />
        )}

        {showParsedFields && showParsedFields.length > 0 && (
          <MetaInfoText
            metaItems={[
              {
                label: 'Showing only parsed fields',
                value: renderMetaItem(showParsedFields, LogsMetaKind.LabelsMap),
              },
              {
                label: '',
                value: (
                  <Button variant="secondary" size="sm" onClick={this.clearParsedFields}>
                    Show all parsed fields
                  </Button>
                ),
              },
            ]}
          />
        )}

        <LogRows
          logRows={logRows}
          deduplicatedRows={dedupedRows}
          dedupStrategy={dedupStrategy}
          getRowContext={this.props.getRowContext}
          highlighterExpressions={highlighterExpressions}
          rowLimit={logRows ? logRows.length : undefined}
          onClickFilterLabel={onClickFilterLabel}
          onClickFilterOutLabel={onClickFilterOutLabel}
          showContextToggle={showContextToggle}
          showLabels={showLabels}
          showTime={showTime}
          wrapLogMessage={wrapLogMessage}
          timeZone={timeZone}
          getFieldLinks={getFieldLinks}
          logsSortOrder={logsSortOrder}
          showParsedFields={showParsedFields}
          onClickShowParsedField={this.showParsedField}
          onClickHideParsedField={this.hideParsedField}
        />

        {!loading && !hasData && !scanning && (
          <div className="logs-panel-nodata">
            No logs found.
            <Button size="xs" variant="link" onClick={this.onClickScan}>
              Scan for older logs
            </Button>
          </div>
        )}

        {scanning && (
          <div className="logs-panel-nodata">
            <span>{scanText}</span>
            <Button size="xs" variant="link" onClick={this.onClickStopScan}>
              Stop scan
            </Button>
          </div>
        )}
      </div>
    );
  }
}
