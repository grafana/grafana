import React, { PureComponent } from 'react';
import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import memoizeOne from 'memoize-one';

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
  GrafanaTheme,
} from '@grafana/data';
import {
  LogLabels,
  RadioButtonGroup,
  LogRows,
  Button,
  InlineField,
  InlineFieldRow,
  InlineSwitch,
  withTheme,
  stylesFactory,
  Icon,
  Tooltip,
} from '@grafana/ui';
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
  } else if (kind === LogsMetaKind.Error) {
    return <span className="logs-meta-item__error">{value}</span>;
  }
  return value;
}

interface Props {
  logRows: LogRowModel[];
  logsMeta?: LogsMetaItem[];
  logsSeries?: GraphSeriesXY[];
  dedupedRows?: LogRowModel[];
  visibleRange?: AbsoluteTimeRange;
  width: number;
  theme: GrafanaTheme;
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
  showDetectedFields: string[];
  forceEscape: boolean;
}

export class UnthemedLogs extends PureComponent<Props, State> {
  flipOrderTimer: NodeJS.Timeout;
  cancelFlippingTimer: NodeJS.Timeout;

  state: State = {
    showLabels: store.getBool(SETTINGS_KEYS.showLabels, false),
    showTime: store.getBool(SETTINGS_KEYS.showTime, true),
    wrapLogMessage: store.getBool(SETTINGS_KEYS.wrapLogMessage, true),
    logsSortOrder: null,
    isFlipping: false,
    showDetectedFields: [],
    forceEscape: false,
  };

  componentWillUnmount() {
    clearTimeout(this.flipOrderTimer);
    clearTimeout(this.cancelFlippingTimer);
  }

  onChangeLogsSortOrder = () => {
    this.setState({ isFlipping: true });
    // we are using setTimeout here to make sure that disabled button is rendered before the rendering of reordered logs
    this.flipOrderTimer = setTimeout(() => {
      this.setState((prevState) => {
        if (prevState.logsSortOrder === null || prevState.logsSortOrder === LogsSortOrder.Descending) {
          return { logsSortOrder: LogsSortOrder.Ascending };
        }
        return { logsSortOrder: LogsSortOrder.Descending };
      });
    }, 0);
    this.cancelFlippingTimer = setTimeout(() => this.setState({ isFlipping: false }), 1000);
  };

  onEscapeNewlines = () => {
    this.setState((prevState) => ({
      forceEscape: !prevState.forceEscape,
    }));
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
    const hiddenLogLevels: LogLevel[] = hiddenRawLevels.map((level) => LogLevel[level as LogLevel]);
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

  showDetectedField = (key: string) => {
    const index = this.state.showDetectedFields.indexOf(key);

    if (index === -1) {
      this.setState((state) => {
        return {
          showDetectedFields: state.showDetectedFields.concat(key),
        };
      });
    }
  };

  hideDetectedField = (key: string) => {
    const index = this.state.showDetectedFields.indexOf(key);
    if (index > -1) {
      this.setState((state) => {
        return {
          showDetectedFields: state.showDetectedFields.filter((k) => key !== k),
        };
      });
    }
  };

  clearDetectedFields = () => {
    this.setState((state) => {
      return {
        showDetectedFields: [],
      };
    });
  };

  checkUnescapedContent = memoizeOne((logRows: LogRowModel[]) => {
    return !!logRows.some((r) => r.hasUnescapedContent);
  });

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
      dedupStrategy,
      theme,
    } = this.props;

    const {
      showLabels,
      showTime,
      wrapLogMessage,
      logsSortOrder,
      isFlipping,
      showDetectedFields,
      forceEscape,
    } = this.state;

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

    if (logRows.some((r) => r.entry.length > MAX_CHARACTERS)) {
      meta.push({
        label: 'Info',
        value: 'Logs with more than 100,000 characters could not be parsed and highlighted',
        kind: LogsMetaKind.String,
      });
    }

    const scanText = scanRange ? `Scanning ${rangeUtil.describeTimeRange(scanRange)}` : 'Scanning...';
    const series = logsSeries ? logsSeries : [];
    const styles = getStyles(theme);
    const hasUnescapedContent = this.checkUnescapedContent(logRows);

    return (
      <>
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
        <div className={styles.logOptions}>
          <InlineFieldRow>
            <InlineField label="Time" transparent>
              <InlineSwitch value={showTime} onChange={this.onChangeTime} transparent />
            </InlineField>
            <InlineField label="Unique labels" transparent>
              <InlineSwitch value={showLabels} onChange={this.onChangeLabels} transparent />
            </InlineField>
            <InlineField label="Wrap lines" transparent>
              <InlineSwitch value={wrapLogMessage} onChange={this.onChangewrapLogMessage} transparent />
            </InlineField>
            <InlineField label="Dedup" transparent>
              <RadioButtonGroup
                options={Object.keys(LogsDedupStrategy).map((dedupType: LogsDedupStrategy) => ({
                  label: capitalize(dedupType),
                  value: dedupType,
                  description: LogsDedupDescription[dedupType],
                }))}
                value={dedupStrategy}
                onChange={this.onChangeDedup}
                className={styles.radioButtons}
              />
            </InlineField>
          </InlineFieldRow>
          <Button
            variant="secondary"
            disabled={isFlipping}
            title={logsSortOrder === LogsSortOrder.Ascending ? 'Change to newest first' : 'Change to oldest first'}
            aria-label="Flip results order"
            className={styles.flipButton}
            onClick={this.onChangeLogsSortOrder}
          >
            {isFlipping ? 'Flipping...' : 'Flip results order'}
          </Button>
        </div>

        {meta && (
          <MetaInfoText
            metaItems={meta.map((item) => {
              return {
                label: item.label,
                value: renderMetaItem(item.value, item.kind),
              };
            })}
          />
        )}

        {showDetectedFields?.length > 0 && (
          <MetaInfoText
            metaItems={[
              {
                label: 'Showing only detected fields',
                value: renderMetaItem(showDetectedFields, LogsMetaKind.LabelsMap),
              },
              {
                label: '',
                value: (
                  <Button variant="secondary" size="sm" onClick={this.clearDetectedFields}>
                    Show all detected fields
                  </Button>
                ),
              },
            ]}
          />
        )}

        {hasUnescapedContent && (
          <MetaInfoText
            metaItems={[
              {
                label: 'Your logs might have incorrectly escaped content',
                value: (
                  <Tooltip
                    content="We suggest to try to fix the escaping of your log lines first. This is an experimental feature, your logs might not be correctly escaped."
                    placement="right"
                  >
                    <Button variant="secondary" size="sm" onClick={this.onEscapeNewlines}>
                      <span>{forceEscape ? 'Remove escaping' : 'Escape newlines'}&nbsp;</span>
                      <Icon name="exclamation-triangle" className="muted" size="sm" />
                    </Button>
                  </Tooltip>
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
          onClickFilterLabel={onClickFilterLabel}
          onClickFilterOutLabel={onClickFilterOutLabel}
          showContextToggle={showContextToggle}
          showLabels={showLabels}
          showTime={showTime}
          forceEscape={forceEscape}
          wrapLogMessage={wrapLogMessage}
          timeZone={timeZone}
          getFieldLinks={getFieldLinks}
          logsSortOrder={logsSortOrder}
          showDetectedFields={showDetectedFields}
          onClickShowDetectedField={this.showDetectedField}
          onClickHideDetectedField={this.hideDetectedField}
        />

        {!loading && !hasData && !scanning && (
          <div className={styles.noData}>
            No logs found.
            <Button size="xs" buttonStyle="text" onClick={this.onClickScan}>
              Scan for older logs
            </Button>
          </div>
        )}

        {scanning && (
          <div className={styles.noData}>
            <span>{scanText}</span>
            <Button size="xs" buttonStyle="text" onClick={this.onClickStopScan}>
              Stop scan
            </Button>
          </div>
        )}
      </>
    );
  }
}

export const Logs = withTheme(UnthemedLogs);

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    noData: css`
      > * {
        margin-left: 0.5em;
      }
    `,
    logOptions: css`
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      flex-wrap: wrap;
      background-color: ${theme.colors.bg1};
      padding: ${theme.spacing.sm} ${theme.spacing.md};
      border-radius: ${theme.border.radius.md};
      margin: ${theme.spacing.md} 0 ${theme.spacing.sm};
      border: 1px solid ${theme.colors.border2};
    `,
    flipButton: css`
      margin: ${theme.spacing.xs} 0 0 ${theme.spacing.sm};
    `,
    radioButtons: css`
      margin: 0 ${theme.spacing.sm};
    `,
  };
});
