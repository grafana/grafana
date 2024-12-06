import { debounce } from 'lodash';
import memoizeOne from 'memoize-one';
import * as React from 'react';
import { MouseEvent, PureComponent, ReactNode } from 'react';

import {
  CoreApp,
  DataFrame,
  dateTimeFormat,
  Field,
  LinkModel,
  LogRowContextOptions,
  LogRowModel,
  LogsSortOrder,
} from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { DataQuery, TimeZone } from '@grafana/schema';
import { Icon, PopoverContent, Themeable2, Tooltip, withTheme2 } from '@grafana/ui';

import { checkLogsError, checkLogsSampled, escapeUnescapedString } from '../utils';

import { LogDetails } from './LogDetails';
import { LogLabels } from './LogLabels';
import { LogRowMessage } from './LogRowMessage';
import { LogRowMessageDisplayedFields } from './LogRowMessageDisplayedFields';
import { getLogLevelStyles, LogRowStyles } from './getLogRowStyles';

interface Props extends Themeable2 {
  row: LogRowModel;
  showDuplicates: boolean;
  showLabels: boolean;
  showTime: boolean;
  wrapLogMessage: boolean;
  prettifyLogMessage: boolean;
  timeZone: TimeZone;
  enableLogDetails: boolean;
  logsSortOrder?: LogsSortOrder | null;
  forceEscape?: boolean;
  app?: CoreApp;
  displayedFields?: string[];
  getRows: () => LogRowModel[];
  onClickFilterLabel?: (key: string, value: string, frame?: DataFrame) => void;
  onClickFilterOutLabel?: (key: string, value: string, frame?: DataFrame) => void;
  onContextClick?: () => void;
  getFieldLinks?: (field: Field, rowIndex: number, dataFrame: DataFrame) => Array<LinkModel<Field>>;
  showContextToggle?: (row: LogRowModel) => boolean;
  onClickShowField?: (key: string) => void;
  onClickHideField?: (key: string) => void;
  onLogRowHover?: (row?: LogRowModel) => void;
  onOpenContext: (row: LogRowModel, onClose: () => void) => void;
  getRowContextQuery?: (
    row: LogRowModel,
    options?: LogRowContextOptions,
    cacheFilters?: boolean
  ) => Promise<DataQuery | null>;
  onPermalinkClick?: (row: LogRowModel) => Promise<void>;
  styles: LogRowStyles;
  permalinkedRowId?: string;
  scrollIntoView?: (element: HTMLElement) => void;
  isFilterLabelActive?: (key: string, value: string, refId?: string) => Promise<boolean>;
  onPinLine?: (row: LogRowModel, allowUnPin?: boolean) => void;
  onUnpinLine?: (row: LogRowModel) => void;
  pinLineButtonTooltipTitle?: PopoverContent;
  pinned?: boolean;
  containerRendered?: boolean;
  handleTextSelection?: (e: MouseEvent<HTMLTableRowElement>, row: LogRowModel) => boolean;
  logRowMenuIconsBefore?: ReactNode[];
  logRowMenuIconsAfter?: ReactNode[];
}

interface State {
  permalinked: boolean;
  showingContext: boolean;
  showDetails: boolean;
  mouseIsOver: boolean;
}

/**
 * Renders a log line.
 *
 * When user hovers over it for a certain time, it lazily parses the log line.
 * Once a parser is found, it will determine fields, that will be highlighted.
 * When the user requests stats for a field, they will be calculated and rendered below the row.
 */
class UnThemedLogRow extends PureComponent<Props, State> {
  state: State = {
    permalinked: false,
    showingContext: false,
    showDetails: false,
    mouseIsOver: false,
  };
  logLineRef: React.RefObject<HTMLTableRowElement>;
  private timestamp = '';
  private levelStyles: ReturnType<typeof getLogLevelStyles> | null = null;
  private processedRow: LogRowModel;

  constructor(props: Props) {
    super(props);
    this.logLineRef = React.createRef();
    this.processedRow = props.row;
    this.updateTimestamp();
    this.updateLevelStyles();
    this.updateProcessedRow();
  }

  updateTimestamp() {
    this.timestamp = dateTimeFormat(this.props.row.timeEpochMs, {
      timeZone: this.props.timeZone,
      defaultWithMS: true,
    });
  }

  updateLevelStyles() {
    this.levelStyles = getLogLevelStyles(this.props.theme, this.props.row.logLevel);
  }

  updateProcessedRow() {
    this.processedRow = this.escapeRow(this.props.row, this.props.forceEscape);
  }

  // we are debouncing the state change by 3 seconds to highlight the logline after the context closed.
  debouncedContextClose = debounce(() => {
    this.setState({ showingContext: false });
  }, 3000);

  onOpenContext = (row: LogRowModel) => {
    this.setState({ showingContext: true });
    this.props.onOpenContext(row, this.debouncedContextClose);
  };

  onRowClick = (e: MouseEvent<HTMLTableRowElement>) => {
    if (this.props.handleTextSelection?.(e, this.props.row)) {
      // Event handled by the parent.
      return;
    }

    if (!this.props.enableLogDetails) {
      return;
    }

    this.setState((state) => {
      return {
        showDetails: !state.showDetails,
      };
    });
  };

  onMouseEnter = () => {
    this.setState({ mouseIsOver: true });
    if (this.props.onLogRowHover) {
      this.props.onLogRowHover(this.props.row);
    }
  };

  onMouseMove = (e: MouseEvent) => {
    // No need to worry about text selection.
    if (!this.props.handleTextSelection) {
      return;
    }
    // The user is selecting text, so hide the log row menu so it doesn't interfere.
    if (document.getSelection()?.toString() && e.buttons > 0) {
      this.setState({ mouseIsOver: false });
    }
  };

  onMouseLeave = () => {
    this.setState({ mouseIsOver: false });
  };

  componentDidMount() {
    this.scrollToLogRow(this.state, true);
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    this.scrollToLogRow(prevState);
    if (this.props.row.timeEpochMs !== prevProps.row.timeEpochMs || this.props.timeZone !== prevProps.timeZone) {
      this.updateTimestamp();
    }
    if (this.props.row.logLevel !== prevProps.row.logLevel || this.props.theme !== prevProps.theme) {
      this.updateLevelStyles();
    }
    if (this.props.row !== prevProps.row || this.props.forceEscape !== prevProps.forceEscape) {
      this.updateProcessedRow();
    }
  }

  scrollToLogRow = (prevState: State, mounted = false) => {
    const { row, permalinkedRowId, scrollIntoView, containerRendered } = this.props;

    if (permalinkedRowId !== row.uid) {
      // only set the new state if the row is not permalinked anymore or if the component was mounted.
      if (prevState.permalinked || mounted) {
        this.setState({ permalinked: false });
      }
      return;
    }

    if (!this.state.permalinked && containerRendered && this.logLineRef.current && scrollIntoView) {
      // at this point this row is the permalinked row, so we need to scroll to it and highlight it if possible.
      scrollIntoView(this.logLineRef.current);
      reportInteraction('grafana_explore_logs_permalink_opened', {
        datasourceType: row.datasourceType ?? 'unknown',
        logRowUid: row.uid,
      });
      this.setState({ permalinked: true });
    }
  };

  escapeRow = memoizeOne((row: LogRowModel, forceEscape: boolean | undefined) => {
    return row.hasUnescapedContent && forceEscape
      ? { ...row, entry: escapeUnescapedString(row.entry), raw: escapeUnescapedString(row.raw) }
      : row;
  });

  render() {
    const {
      getRows,
      onClickFilterLabel,
      onClickFilterOutLabel,
      onClickShowField,
      onClickHideField,
      enableLogDetails,
      row,
      showDuplicates,
      showContextToggle,
      showLabels,
      showTime,
      displayedFields,
      wrapLogMessage,
      prettifyLogMessage,
      getFieldLinks,
      app,
      styles,
      getRowContextQuery,
      pinned,
      logRowMenuIconsBefore,
      logRowMenuIconsAfter,
    } = this.props;

    const { showDetails, showingContext, permalinked } = this.state;
    const { errorMessage, hasError } = checkLogsError(row);
    const { sampleMessage, isSampled } = checkLogsSampled(row);

    return (
      <>
        <tr
          ref={this.logLineRef}
          className={`${styles.logsRow} ${hasError ? styles.errorLogRow : ''} ${showingContext || permalinked || pinned ? styles.highlightBackground : ''}`}
          onClick={this.onRowClick}
          onMouseEnter={this.onMouseEnter}
          onMouseLeave={this.onMouseLeave}
          onMouseMove={this.onMouseMove}
          /**
           * For better accessibility support, we listen to the onFocus event here (to display the LogRowMenuCell), and
           * to onBlur event in the LogRowMenuCell (to hide it). This way, the LogRowMenuCell is displayed when the user navigates
           * using the keyboard.
           */
          onFocus={this.onMouseEnter}
        >
          {showDuplicates && (
            <td className={styles.logsRowDuplicates}>
              {this.processedRow.duplicates && this.processedRow.duplicates > 0
                ? `${this.processedRow.duplicates + 1}x`
                : null}
            </td>
          )}
          <td
            className={
              hasError || isSampled
                ? styles.logsRowWithError
                : `${this.levelStyles?.logsRowLevelColor ?? ''} ${styles.logsRowLevel}`
            }
          >
            {hasError && (
              <Tooltip content={`Error: ${errorMessage}`} placement="right" theme="error">
                <Icon className={styles.logIconError} name="exclamation-triangle" size="xs" />
              </Tooltip>
            )}
            {isSampled && (
              <Tooltip content={`${sampleMessage}`} placement="right" theme="info">
                <Icon className={styles.logIconInfo} name="info-circle" size="xs" />
              </Tooltip>
            )}
          </td>
          <td
            title={enableLogDetails ? (showDetails ? 'Hide log details' : 'See log details') : ''}
            className={enableLogDetails ? styles.logsRowToggleDetails : ''}
          >
            {enableLogDetails && (
              <Icon className={styles.topVerticalAlign} name={showDetails ? 'angle-down' : 'angle-right'} />
            )}
          </td>
          {showTime && <td className={styles.logsRowLocalTime}>{this.timestamp}</td>}
          {showLabels && this.processedRow.uniqueLabels && (
            <td className={styles.logsRowLabels}>
              <LogLabels labels={this.processedRow.uniqueLabels} />
            </td>
          )}
          {displayedFields && displayedFields.length > 0 ? (
            <LogRowMessageDisplayedFields
              row={this.processedRow}
              showContextToggle={showContextToggle}
              detectedFields={displayedFields}
              getFieldLinks={getFieldLinks}
              wrapLogMessage={wrapLogMessage}
              onOpenContext={this.onOpenContext}
              onPermalinkClick={this.props.onPermalinkClick}
              styles={styles}
              onPinLine={this.props.onPinLine}
              onUnpinLine={this.props.onUnpinLine}
              pinned={this.props.pinned}
              mouseIsOver={this.state.mouseIsOver}
              onBlur={this.onMouseLeave}
              logRowMenuIconsBefore={logRowMenuIconsBefore}
              logRowMenuIconsAfter={logRowMenuIconsAfter}
            />
          ) : (
            <LogRowMessage
              row={this.processedRow}
              showContextToggle={showContextToggle}
              getRowContextQuery={getRowContextQuery}
              wrapLogMessage={wrapLogMessage}
              prettifyLogMessage={prettifyLogMessage}
              onOpenContext={this.onOpenContext}
              onPermalinkClick={this.props.onPermalinkClick}
              app={app}
              styles={styles}
              onPinLine={this.props.onPinLine}
              onUnpinLine={this.props.onUnpinLine}
              pinLineButtonTooltipTitle={this.props.pinLineButtonTooltipTitle}
              pinned={this.props.pinned}
              mouseIsOver={this.state.mouseIsOver}
              onBlur={this.onMouseLeave}
              expanded={this.state.showDetails}
              logRowMenuIconsBefore={logRowMenuIconsBefore}
              logRowMenuIconsAfter={logRowMenuIconsAfter}
            />
          )}
        </tr>
        {this.state.showDetails && (
          <LogDetails
            onPinLine={this.props.onPinLine}
            className={`${styles.logsRow} ${hasError ? styles.errorLogRow : ''} ${permalinked && !this.state.showDetails ? styles.highlightBackground : ''}`}
            showDuplicates={showDuplicates}
            getFieldLinks={getFieldLinks}
            onClickFilterLabel={onClickFilterLabel}
            onClickFilterOutLabel={onClickFilterOutLabel}
            onClickShowField={onClickShowField}
            onClickHideField={onClickHideField}
            getRows={getRows}
            row={this.processedRow}
            wrapLogMessage={wrapLogMessage}
            hasError={hasError}
            displayedFields={displayedFields}
            app={app}
            styles={styles}
            isFilterLabelActive={this.props.isFilterLabelActive}
            pinLineButtonTooltipTitle={this.props.pinLineButtonTooltipTitle}
          />
        )}
      </>
    );
  }
}

export const LogRow = withTheme2(UnThemedLogRow);
LogRow.displayName = 'LogRow';
