import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import memoizeOne from 'memoize-one';
import React, { PureComponent, createRef } from 'react';

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
  DataFrame,
  GrafanaTheme2,
  LoadingState,
  SplitOpen,
  DataQueryResponse,
  CoreApp,
  DataHoverEvent,
  DataHoverClearEvent,
  EventBus,
  DataSourceWithLogsContextSupport,
  LogRowContextOptions,
} from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import {
  RadioButtonGroup,
  Button,
  InlineField,
  InlineFieldRow,
  InlineSwitch,
  withTheme2,
  Themeable2,
  Collapse,
} from '@grafana/ui';
import { dedupLogRows, filterLogLevels } from 'app/core/logsModel';
import store from 'app/core/store';
import { ExploreId } from 'app/types/explore';

import { LogRows } from '../logs/components/LogRows';
import { LogRowContextModal } from '../logs/components/log-context/LogRowContextModal';

import { LogsMetaRow } from './LogsMetaRow';
import LogsNavigation from './LogsNavigation';
import { LogsVolumePanelList } from './LogsVolumePanelList';
import { SETTINGS_KEYS } from './utils/logs';

interface Props extends Themeable2 {
  width: number;
  splitOpen: SplitOpen;
  logRows: LogRowModel[];
  logsMeta?: LogsMetaItem[];
  logsSeries?: DataFrame[];
  logsQueries?: DataQuery[];
  visibleRange?: AbsoluteTimeRange;
  theme: GrafanaTheme2;
  loading: boolean;
  loadingState: LoadingState;
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  scanning?: boolean;
  scanRange?: RawTimeRange;
  exploreId: ExploreId;
  datasourceType?: string;
  logsVolumeEnabled: boolean;
  logsVolumeData: DataQueryResponse | undefined;
  scrollElement?: HTMLDivElement;
  onSetLogsVolumeEnabled: (enabled: boolean) => void;
  loadLogsVolumeData: () => void;
  showContextToggle?: (row?: LogRowModel) => boolean;
  onChangeTime: (range: AbsoluteTimeRange) => void;
  onClickFilterLabel: (key: string, value: string) => void;
  onClickFilterOutLabel: (key: string, value: string) => void;
  onStartScanning?: () => void;
  onStopScanning?: () => void;
  getRowContext?: (row: LogRowModel, options?: LogRowContextOptions) => Promise<any>;
  getLogRowContextUi?: DataSourceWithLogsContextSupport['getLogRowContextUi'];
  getFieldLinks: (field: Field, rowIndex: number, dataFrame: DataFrame) => Array<LinkModel<Field>>;
  addResultsToCache: () => void;
  clearCache: () => void;
  eventBus: EventBus;
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
  displayedFields: string[];
  forceEscape: boolean;
  contextOpen: boolean;
  contextRow?: LogRowModel;
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

// we need to define the order of these explicitly
const DEDUP_OPTIONS = [
  LogsDedupStrategy.none,
  LogsDedupStrategy.exact,
  LogsDedupStrategy.numbers,
  LogsDedupStrategy.signature,
];

class UnthemedLogs extends PureComponent<Props, State> {
  flipOrderTimer?: number;
  cancelFlippingTimer?: number;
  topLogsRef = createRef<HTMLDivElement>();
  logsVolumeEventBus: EventBus;

  state: State = {
    showLabels: store.getBool(SETTINGS_KEYS.showLabels, false),
    showTime: store.getBool(SETTINGS_KEYS.showTime, true),
    wrapLogMessage: store.getBool(SETTINGS_KEYS.wrapLogMessage, true),
    prettifyLogMessage: store.getBool(SETTINGS_KEYS.prettifyLogMessage, false),
    dedupStrategy: LogsDedupStrategy.none,
    hiddenLogLevels: [],
    logsSortOrder: store.get(SETTINGS_KEYS.logsSortOrder) || LogsSortOrder.Descending,
    isFlipping: false,
    displayedFields: [],
    forceEscape: false,
    contextOpen: false,
    contextRow: undefined,
  };

  constructor(props: Props) {
    super(props);
    this.logsVolumeEventBus = props.eventBus.newScopedBus('logsvolume', { onlyLocal: false });
  }

  componentWillUnmount() {
    if (this.flipOrderTimer) {
      window.clearTimeout(this.flipOrderTimer);
    }

    if (this.cancelFlippingTimer) {
      window.clearTimeout(this.cancelFlippingTimer);
    }
  }

  onLogRowHover = (row?: LogRowModel) => {
    if (!row) {
      this.props.eventBus.publish(new DataHoverClearEvent());
    } else {
      this.props.eventBus.publish(
        new DataHoverEvent({
          point: {
            time: row.timeEpochMs,
          },
        })
      );
    }
  };

  onChangeLogsSortOrder = () => {
    this.setState({ isFlipping: true });
    // we are using setTimeout here to make sure that disabled button is rendered before the rendering of reordered logs
    this.flipOrderTimer = window.setTimeout(() => {
      this.setState((prevState) => {
        const newSortOrder =
          prevState.logsSortOrder === LogsSortOrder.Descending ? LogsSortOrder.Ascending : LogsSortOrder.Descending;
        store.set(SETTINGS_KEYS.logsSortOrder, newSortOrder);
        return { logsSortOrder: newSortOrder };
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
    reportInteraction('grafana_explore_logs_deduplication_clicked', {
      deduplicationType: dedupStrategy,
      datasourceType: this.props.datasourceType,
    });
    this.setState({ dedupStrategy });
  };

  onChangeLabels = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { target } = event;
    if (target) {
      const showLabels = target.checked;
      this.setState({
        showLabels,
      });
      store.set(SETTINGS_KEYS.showLabels, showLabels);
    }
  };

  onChangeTime = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { target } = event;
    if (target) {
      const showTime = target.checked;
      this.setState({
        showTime,
      });
      store.set(SETTINGS_KEYS.showTime, showTime);
    }
  };

  onChangeWrapLogMessage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { target } = event;
    if (target) {
      const wrapLogMessage = target.checked;
      this.setState({
        wrapLogMessage,
      });
      store.set(SETTINGS_KEYS.wrapLogMessage, wrapLogMessage);
    }
  };

  onChangePrettifyLogMessage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { target } = event;
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

  onToggleLogsVolumeCollapse = (isOpen: boolean) => {
    this.props.onSetLogsVolumeEnabled(isOpen);
    reportInteraction('grafana_explore_logs_histogram_toggle_clicked', {
      datasourceType: this.props.datasourceType,
      type: isOpen ? 'open' : 'close',
    });
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

  showField = (key: string) => {
    const index = this.state.displayedFields.indexOf(key);

    if (index === -1) {
      this.setState((state) => {
        return {
          displayedFields: state.displayedFields.concat(key),
        };
      });
    }
  };

  hideField = (key: string) => {
    const index = this.state.displayedFields.indexOf(key);
    if (index > -1) {
      this.setState((state) => {
        return {
          displayedFields: state.displayedFields.filter((k) => key !== k),
        };
      });
    }
  };

  clearDetectedFields = () => {
    this.setState((state) => {
      return {
        displayedFields: [],
      };
    });
  };

  onCloseContext = () => {
    this.setState({
      contextOpen: false,
      contextRow: undefined,
    });
  };

  onOpenContext = (row: LogRowModel, onClose: () => void) => {
    this.setState({
      contextOpen: true,
      contextRow: row,
    });
    this.onCloseContext = () => {
      this.setState({
        contextOpen: false,
        contextRow: undefined,
      });
      onClose();
    };
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

  createNavigationRange = memoizeOne((logRows: LogRowModel[]): { from: number; to: number } | undefined => {
    if (!logRows || logRows.length === 0) {
      return undefined;
    }
    const firstTimeStamp = logRows[0].timeEpochMs;
    const lastTimeStamp = logRows[logRows.length - 1].timeEpochMs;

    if (lastTimeStamp < firstTimeStamp) {
      return { from: lastTimeStamp, to: firstTimeStamp };
    }

    return { from: firstTimeStamp, to: lastTimeStamp };
  });

  scrollToTopLogs = () => this.topLogsRef.current?.scrollIntoView();

  render() {
    const {
      width,
      splitOpen,
      logRows,
      logsMeta,
      logsVolumeEnabled,
      logsVolumeData,
      loadLogsVolumeData,
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
      exploreId,
      scrollElement,
      getRowContext,
      getLogRowContextUi,
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
      displayedFields,
      forceEscape,
      contextOpen,
      contextRow,
    } = this.state;

    const styles = getStyles(theme, wrapLogMessage);
    const hasData = logRows && logRows.length > 0;
    const hasUnescapedContent = this.checkUnescapedContent(logRows);

    const filteredLogs = this.filterRows(logRows, hiddenLogLevels);
    const { dedupedRows, dedupCount } = this.dedupRows(filteredLogs, dedupStrategy);
    const navigationRange = this.createNavigationRange(logRows);

    const scanText = scanRange ? `Scanning ${rangeUtil.describeTimeRange(scanRange)}` : 'Scanning...';

    return (
      <>
        {contextRow && (
          <LogRowContextModal
            open={contextOpen}
            row={contextRow}
            onClose={this.onCloseContext}
            getRowContext={getRowContext ?? (() => Promise.resolve({}))}
            getLogRowContextUi={getLogRowContextUi}
            logsSortOrder={logsSortOrder}
            timeZone={timeZone}
          />
        )}
        <Collapse label="Logs volume" collapsible isOpen={logsVolumeEnabled} onToggle={this.onToggleLogsVolumeCollapse}>
          {logsVolumeEnabled && (
            <LogsVolumePanelList
              absoluteRange={absoluteRange}
              width={width}
              logsVolumeData={logsVolumeData}
              onUpdateTimeRange={onChangeTime}
              timeZone={timeZone}
              splitOpen={splitOpen}
              onLoadLogsVolume={loadLogsVolumeData}
              onHiddenSeriesChanged={this.onToggleLogLevel}
              eventBus={this.logsVolumeEventBus}
              onClose={() => this.onToggleLogsVolumeCollapse(false)}
            />
          )}
        </Collapse>
        <Collapse label="Logs" loading={loading} isOpen className={styleOverridesForStickyNavigation}>
          <div className={styles.logOptions}>
            <InlineFieldRow>
              <InlineField label="Time" className={styles.horizontalInlineLabel} transparent>
                <InlineSwitch
                  value={showTime}
                  onChange={this.onChangeTime}
                  className={styles.horizontalInlineSwitch}
                  transparent
                  id={`show-time_${exploreId}`}
                />
              </InlineField>
              <InlineField label="Unique labels" className={styles.horizontalInlineLabel} transparent>
                <InlineSwitch
                  value={showLabels}
                  onChange={this.onChangeLabels}
                  className={styles.horizontalInlineSwitch}
                  transparent
                  id={`unique-labels_${exploreId}`}
                />
              </InlineField>
              <InlineField label="Wrap lines" className={styles.horizontalInlineLabel} transparent>
                <InlineSwitch
                  value={wrapLogMessage}
                  onChange={this.onChangeWrapLogMessage}
                  className={styles.horizontalInlineSwitch}
                  transparent
                  id={`wrap-lines_${exploreId}`}
                />
              </InlineField>
              <InlineField label="Prettify JSON" className={styles.horizontalInlineLabel} transparent>
                <InlineSwitch
                  value={prettifyLogMessage}
                  onChange={this.onChangePrettifyLogMessage}
                  className={styles.horizontalInlineSwitch}
                  transparent
                  id={`prettify_${exploreId}`}
                />
              </InlineField>
              <InlineField label="Deduplication" className={styles.horizontalInlineLabel} transparent>
                <RadioButtonGroup
                  options={DEDUP_OPTIONS.map((dedupType) => ({
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
            <div>
              <InlineField label="Display results" className={styles.horizontalInlineLabel} transparent>
                <RadioButtonGroup
                  disabled={isFlipping}
                  options={[
                    {
                      label: 'Newest first',
                      value: LogsSortOrder.Descending,
                      description: 'Show results newest to oldest',
                    },
                    {
                      label: 'Oldest first',
                      value: LogsSortOrder.Ascending,
                      description: 'Show results oldest to newest',
                    },
                  ]}
                  value={logsSortOrder}
                  onChange={this.onChangeLogsSortOrder}
                  className={styles.radioButtons}
                />
              </InlineField>
            </div>
          </div>
          <div ref={this.topLogsRef} />
          <LogsMetaRow
            logRows={logRows}
            meta={logsMeta || []}
            dedupStrategy={dedupStrategy}
            dedupCount={dedupCount}
            hasUnescapedContent={hasUnescapedContent}
            forceEscape={forceEscape}
            displayedFields={displayedFields}
            onEscapeNewlines={this.onEscapeNewlines}
            clearDetectedFields={this.clearDetectedFields}
          />
          <div className={styles.logsSection}>
            <div className={styles.logRows} data-testid="logRows">
              <LogRows
                logRows={logRows}
                deduplicatedRows={dedupedRows}
                dedupStrategy={dedupStrategy}
                getRowContext={getRowContext}
                getLogRowContextUi={getLogRowContextUi}
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
                displayedFields={displayedFields}
                onClickShowField={this.showField}
                onClickHideField={this.hideField}
                app={CoreApp.Explore}
                scrollElement={scrollElement}
                onLogRowHover={this.onLogRowHover}
                onOpenContext={this.onOpenContext}
              />
              {!loading && !hasData && !scanning && (
                <div className={styles.noData}>
                  No logs found.
                  <Button size="sm" variant="secondary" onClick={this.onClickScan}>
                    Scan for older logs
                  </Button>
                </div>
              )}
              {scanning && (
                <div className={styles.noData}>
                  <span>{scanText}</span>
                  <Button size="sm" variant="secondary" onClick={this.onClickStopScan}>
                    Stop scan
                  </Button>
                </div>
              )}
            </div>
            <LogsNavigation
              logsSortOrder={logsSortOrder}
              visibleRange={navigationRange ?? absoluteRange}
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
        </Collapse>
      </>
    );
  }
}

export const Logs = withTheme2(UnthemedLogs);

const getStyles = (theme: GrafanaTheme2, wrapLogMessage: boolean) => {
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
      background-color: ${theme.colors.background.primary};
      padding: ${theme.spacing(1, 2)};
      border-radius: ${theme.shape.borderRadius()};
      margin: ${theme.spacing(0, 0, 1)};
      border: 1px solid ${theme.colors.border.medium};
    `,
    headerButton: css`
      margin: ${theme.spacing(0.5, 0, 0, 1)};
    `,
    horizontalInlineLabel: css`
      > label {
        margin-right: 0;
      }
    `,
    horizontalInlineSwitch: css`
      padding: 0 ${theme.spacing(1)} 0 0;
    `,
    radioButtons: css`
      margin: 0;
    `,
    logsSection: css`
      display: flex;
      flex-direction: row;
      justify-content: space-between;
    `,
    logRows: css`
      overflow-x: ${wrapLogMessage ? 'unset' : 'scroll'};
      overflow-y: visible;
      width: 100%;
    `,
  };
};
