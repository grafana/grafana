import React, { PureComponent, createRef } from 'react';
import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import memoizeOne from 'memoize-one';

import {
  rangeUtil,
  RawTimeRange,
  LogLevel,
  TimeZone,
  AbsoluteTimeRange,
  LogsDedupStrategy,
  LogRowModel,
  LogsDedupDescription,
  LogsMetaItem,
  LogsSortOrder,
  LinkModel,
  Field,
  GrafanaTheme,
  DataQuery,
  DataFrame,
} from '@grafana/data';
import {
  RadioButtonGroup,
  LogRows,
  Button,
  InlineField,
  InlineFieldRow,
  InlineSwitch,
  withTheme,
  stylesFactory,
  TooltipDisplayMode,
} from '@grafana/ui';
import store from 'app/core/store';
import { dedupLogRows, filterLogLevels } from 'app/core/logs_model';
import { LogsMetaRow } from './LogsMetaRow';
import LogsNavigation from './LogsNavigation';
import { RowContextOptions } from '@grafana/ui/src/components/Logs/LogRowContextProvider';
import { ExploreGraphNGPanel } from './ExploreGraphNGPanel';

const SETTINGS_KEYS = {
  showLabels: 'grafana.explore.logs.showLabels',
  showTime: 'grafana.explore.logs.showTime',
  wrapLogMessage: 'grafana.explore.logs.wrapLogMessage',
  prettifyLogMessage: 'grafana.explore.logs.prettifyLogMessage',
};

interface Props {
  width: number;
  logRows: LogRowModel[];
  logsMeta?: LogsMetaItem[];
  logsSeries?: DataFrame[];
  logsQueries?: DataQuery[];
  visibleRange?: AbsoluteTimeRange;
  theme: GrafanaTheme;
  highlighterExpressions?: string[];
  loading: boolean;
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  scanning?: boolean;
  scanRange?: RawTimeRange;
  showContextToggle?: (row?: LogRowModel) => boolean;
  onChangeTime: (range: AbsoluteTimeRange) => void;
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
  onStartScanning?: () => void;
  onStopScanning?: () => void;
  getRowContext?: (row: LogRowModel, options?: RowContextOptions) => Promise<any>;
  getFieldLinks: (field: Field, rowIndex: number) => Array<LinkModel<Field>>;
  addResultsToCache: () => void;
  clearCache: () => void;
}

interface State {
  showLabels: boolean;
  showTime: boolean;
  wrapLogMessage: boolean;
  prettifyLogMessage: boolean;
  dedupStrategy: LogsDedupStrategy;
  hiddenLogLevels: LogLevel[];
  logsSortOrder: LogsSortOrder | null;
  isFlipping: boolean;
  showDetectedFields: string[];
  forceEscape: boolean;
}

export class UnthemedLogs extends PureComponent<Props, State> {
  flipOrderTimer?: number;
  cancelFlippingTimer?: number;
  topLogsRef = createRef<HTMLDivElement>();

  state: State = {
    showLabels: store.getBool(SETTINGS_KEYS.showLabels, false),
    showTime: store.getBool(SETTINGS_KEYS.showTime, true),
    wrapLogMessage: store.getBool(SETTINGS_KEYS.wrapLogMessage, true),
    prettifyLogMessage: store.getBool(SETTINGS_KEYS.prettifyLogMessage, false),
    dedupStrategy: LogsDedupStrategy.none,
    hiddenLogLevels: [],
    logsSortOrder: null,
    isFlipping: false,
    showDetectedFields: [],
    forceEscape: false,
  };

  componentWillUnmount() {
    if (this.flipOrderTimer) {
      window.clearTimeout(this.flipOrderTimer);
    }

    if (this.cancelFlippingTimer) {
      window.clearTimeout(this.cancelFlippingTimer);
    }
  }

  onChangeLogsSortOrder = () => {
    this.setState({ isFlipping: true });
    // we are using setTimeout here to make sure that disabled button is rendered before the rendering of reordered logs
    this.flipOrderTimer = window.setTimeout(() => {
      this.setState((prevState) => {
        if (prevState.logsSortOrder === null || prevState.logsSortOrder === LogsSortOrder.Descending) {
          return { logsSortOrder: LogsSortOrder.Ascending };
        }
        return { logsSortOrder: LogsSortOrder.Descending };
      });
    }, 0);
    this.cancelFlippingTimer = window.setTimeout(() => this.setState({ isFlipping: false }), 1000);
  };

  onEscapeNewlines = () => {
    this.setState((prevState) => ({
      forceEscape: !prevState.forceEscape,
    }));
  };

  onChangeDedup = (dedupStrategy: LogsDedupStrategy) => {
    this.setState({ dedupStrategy });
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

  onChangePrettifyLogMessage = (event?: React.SyntheticEvent) => {
    const target = event && (event.target as HTMLInputElement);
    if (target) {
      const prettifyLogMessage = target.checked;
      this.setState({
        prettifyLogMessage,
      });
      store.set(SETTINGS_KEYS.prettifyLogMessage, prettifyLogMessage);
    }
  };

  onToggleLogLevel = (hiddenRawLevels: string[]) => {
    const hiddenLogLevels = hiddenRawLevels.map((level) => LogLevel[level as LogLevel]);
    this.setState({ hiddenLogLevels });
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

  dedupRows = memoizeOne((logRows: LogRowModel[], dedupStrategy: LogsDedupStrategy) => {
    const dedupedRows = dedupLogRows(logRows, dedupStrategy);
    const dedupCount = dedupedRows.reduce((sum, row) => (row.duplicates ? sum + row.duplicates : sum), 0);
    return { dedupedRows, dedupCount };
  });

  filterRows = memoizeOne((logRows: LogRowModel[], hiddenLogLevels: LogLevel[]) => {
    return filterLogLevels(logRows, new Set(hiddenLogLevels));
  });

  scrollToTopLogs = () => this.topLogsRef.current?.scrollIntoView();

  render() {
    const {
      width,
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
      absoluteRange,
      onChangeTime,
      getFieldLinks,
      theme,
      logsQueries,
      clearCache,
      addResultsToCache,
    } = this.props;

    const {
      showLabels,
      showTime,
      wrapLogMessage,
      prettifyLogMessage,
      dedupStrategy,
      hiddenLogLevels,
      logsSortOrder,
      isFlipping,
      showDetectedFields,
      forceEscape,
    } = this.state;

    const styles = getStyles(theme);
    const hasData = logRows && logRows.length > 0;
    const hasUnescapedContent = this.checkUnescapedContent(logRows);

    const filteredLogs = this.filterRows(logRows, hiddenLogLevels);
    const { dedupedRows, dedupCount } = this.dedupRows(filteredLogs, dedupStrategy);

    const scanText = scanRange ? `Scanning ${rangeUtil.describeTimeRange(scanRange)}` : 'Scanning...';

    return (
      <>
        <div className={styles.infoText}>
          This datasource does not support full-range histograms. The graph is based on the logs seen in the response.
        </div>
        {logsSeries && logsSeries.length ? (
          <ExploreGraphNGPanel
            data={logsSeries}
            height={150}
            width={width}
            tooltipDisplayMode={TooltipDisplayMode.Multi}
            absoluteRange={visibleRange || absoluteRange}
            timeZone={timeZone}
            onUpdateTimeRange={onChangeTime}
            onHiddenSeriesChanged={this.onToggleLogLevel}
          />
        ) : undefined}
        <div className={styles.logOptions} ref={this.topLogsRef}>
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
            <InlineField label="Prettify JSON" transparent>
              <InlineSwitch value={prettifyLogMessage} onChange={this.onChangePrettifyLogMessage} transparent />
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
        <LogsMetaRow
          logRows={logRows}
          meta={logsMeta || []}
          dedupStrategy={dedupStrategy}
          dedupCount={dedupCount}
          hasUnescapedContent={hasUnescapedContent}
          forceEscape={forceEscape}
          showDetectedFields={showDetectedFields}
          onEscapeNewlines={this.onEscapeNewlines}
          clearDetectedFields={this.clearDetectedFields}
        />
        <div className={styles.logsSection}>
          <div className={styles.logRows}>
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
              enableLogDetails={true}
              forceEscape={forceEscape}
              wrapLogMessage={wrapLogMessage}
              prettifyLogMessage={prettifyLogMessage}
              timeZone={timeZone}
              getFieldLinks={getFieldLinks}
              logsSortOrder={logsSortOrder}
              showDetectedFields={showDetectedFields}
              onClickShowDetectedField={this.showDetectedField}
              onClickHideDetectedField={this.hideDetectedField}
            />
          </div>
          <LogsNavigation
            logsSortOrder={logsSortOrder}
            visibleRange={visibleRange ?? absoluteRange}
            absoluteRange={absoluteRange}
            timeZone={timeZone}
            onChangeTime={onChangeTime}
            loading={loading}
            queries={logsQueries ?? []}
            scrollToTopLogs={this.scrollToTopLogs}
            addResultsToCache={addResultsToCache}
            clearCache={clearCache}
          />
        </div>
        {!loading && !hasData && !scanning && (
          <div className={styles.noData}>
            No logs found.
            <Button size="xs" fill="text" onClick={this.onClickScan}>
              Scan for older logs
            </Button>
          </div>
        )}

        {scanning && (
          <div className={styles.noData}>
            <span>{scanText}</span>
            <Button size="xs" fill="text" onClick={this.onClickStopScan}>
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
    logsSection: css`
      display: flex;
      flex-direction: row;
      justify-content: space-between;
    `,
    logRows: css`
      overflow-x: scroll;
      width: 100%;
    `,
    infoText: css`
      font-size: ${theme.typography.size.sm};
      color: ${theme.colors.textWeak};
    `,
  };
});
