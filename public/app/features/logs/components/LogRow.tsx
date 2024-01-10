import { cx } from '@emotion/css';
import { debounce } from 'lodash';
import memoizeOne from 'memoize-one';
import React, { PureComponent, MouseEvent } from 'react';

import {
  Field,
  LinkModel,
  LogRowModel,
  LogsSortOrder,
  dateTimeFormat,
  CoreApp,
  DataFrame,
  LogRowContextOptions,
} from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { DataQuery, TimeZone } from '@grafana/schema';
import { withTheme2, Themeable2, Icon, Tooltip } from '@grafana/ui';

import { checkLogsError, escapeUnescapedString } from '../utils';

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
  onPinLine?: (row: LogRowModel) => void;
  onUnpinLine?: (row: LogRowModel) => void;
  pinned?: boolean;
  containerRendered?: boolean;
  handleTextSelection?: (e: MouseEvent<HTMLTableRowElement>, row: LogRowModel) => boolean;
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

  constructor(props: Props) {
    super(props);
    this.logLineRef = React.createRef();
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

    reportInteraction('grafana_explore_logs_log_details_clicked', {
      datasourceType: this.props.row.datasourceType,
      type: this.state.showDetails ? 'close' : 'open',
      logRowUid: this.props.row.uid,
      app: this.props.app,
    });

    this.setState((state) => {
      return {
        showDetails: !state.showDetails,
      };
    });
  };

  renderTimeStamp(epochMs: number) {
    return dateTimeFormat(epochMs, {
      timeZone: this.props.timeZone,
      defaultWithMS: true,
    });
  }

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
    if (this.props.onLogRowHover) {
      this.props.onLogRowHover(undefined);
    }
  };

  componentDidMount() {
    this.scrollToLogRow(this.state, true);
  }

  componentDidUpdate(_: Props, prevState: State) {
    this.scrollToLogRow(prevState);
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
      theme,
      getFieldLinks,
      forceEscape,
      app,
      styles,
      getRowContextQuery,
    } = this.props;
    const { showDetails, showingContext, permalinked } = this.state;
    const levelStyles = getLogLevelStyles(theme, row.logLevel);
    const { errorMessage, hasError } = checkLogsError(row);
    const logRowBackground = cx(styles.logsRow, {
      [styles.errorLogRow]: hasError,
      [styles.highlightBackground]: showingContext || permalinked,
    });
    const logRowDetailsBackground = cx(styles.logsRow, {
      [styles.errorLogRow]: hasError,
      [styles.highlightBackground]: permalinked && !this.state.showDetails,
    });

    const processedRow = this.escapeRow(row, forceEscape);

    return (
      <>
        <tr
          ref={this.logLineRef}
          className={logRowBackground}
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
              {processedRow.duplicates && processedRow.duplicates > 0 ? `${processedRow.duplicates + 1}x` : null}
            </td>
          )}
          <td className={hasError ? '' : `${levelStyles.logsRowLevelColor} ${styles.logsRowLevel}`}>
            {hasError && (
              <Tooltip content={`Error: ${errorMessage}`} placement="right" theme="error">
                <Icon className={styles.logIconError} name="exclamation-triangle" size="xs" />
              </Tooltip>
            )}
          </td>
          {enableLogDetails && (
            <td title={showDetails ? 'Hide log details' : 'See log details'} className={styles.logsRowToggleDetails}>
              <Icon className={styles.topVerticalAlign} name={showDetails ? 'angle-down' : 'angle-right'} />
            </td>
          )}
          {showTime && <td className={styles.logsRowLocalTime}>{this.renderTimeStamp(row.timeEpochMs)}</td>}
          {showLabels && processedRow.uniqueLabels && (
            <td className={styles.logsRowLabels}>
              <LogLabels labels={processedRow.uniqueLabels} />
            </td>
          )}
          {displayedFields && displayedFields.length > 0 ? (
            <LogRowMessageDisplayedFields
              row={processedRow}
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
            />
          ) : (
            <LogRowMessage
              row={processedRow}
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
              pinned={this.props.pinned}
              mouseIsOver={this.state.mouseIsOver}
              onBlur={this.onMouseLeave}
            />
          )}
        </tr>
        {this.state.showDetails && (
          <LogDetails
            className={logRowDetailsBackground}
            showDuplicates={showDuplicates}
            getFieldLinks={getFieldLinks}
            onClickFilterLabel={onClickFilterLabel}
            onClickFilterOutLabel={onClickFilterOutLabel}
            onClickShowField={onClickShowField}
            onClickHideField={onClickHideField}
            getRows={getRows}
            row={processedRow}
            wrapLogMessage={wrapLogMessage}
            hasError={hasError}
            displayedFields={displayedFields}
            app={app}
            styles={styles}
            isFilterLabelActive={this.props.isFilterLabelActive}
          />
        )}
      </>
    );
  }
}

export const LogRow = withTheme2(UnThemedLogRow);
LogRow.displayName = 'LogRow';
