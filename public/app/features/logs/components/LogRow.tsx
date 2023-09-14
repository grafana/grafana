import { cx } from '@emotion/css';
import { debounce } from 'lodash';
import React, { FocusEvent, MouseEvent, PureComponent } from 'react';

import { Field, LinkModel, LogRowModel, LogsSortOrder, dateTimeFormat, CoreApp, DataFrame } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { TimeZone } from '@grafana/schema';
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
  onClickFilterLabel?: (key: string, value: string, refId?: string) => void;
  onClickFilterOutLabel?: (key: string, value: string, refId?: string) => void;
  onContextClick?: () => void;
  getFieldLinks?: (field: Field, rowIndex: number, dataFrame: DataFrame) => Array<LinkModel<Field>>;
  showContextToggle?: (row?: LogRowModel) => boolean;
  onClickShowField?: (key: string) => void;
  onClickHideField?: (key: string) => void;
  onLogRowHover?: (row?: LogRowModel) => void;
  onOpenContext: (row: LogRowModel, onClose: () => void) => void;
  onPermalinkClick?: (row: LogRowModel) => Promise<void>;
  styles: LogRowStyles;
  permalinkedRowId?: string;
  scrollIntoView?: (element: HTMLElement) => void;
  isFilterLabelActive?: (key: string, value: string, refId?: string) => Promise<boolean>;
  onPinLine?: (row: LogRowModel) => void;
  onUnpinLine?: (row: LogRowModel) => void;
  pinned?: boolean;
  containerRendered?: boolean;
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

  toggleDetails = () => {
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

  onMouseEnter = (e: MouseEvent | FocusEvent) => {
    e.target?.addEventListener('selectstart', (e) => {
      if (window.getSelection()?.toString()) {
        this.setState({ mouseIsOver: false });
      }
    });
    this.setState({ mouseIsOver: true });
    if (this.props.onLogRowHover) {
      this.props.onLogRowHover(this.props.row);
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

    const processedRow =
      row.hasUnescapedContent && forceEscape
        ? { ...row, entry: escapeUnescapedString(row.entry), raw: escapeUnescapedString(row.raw) }
        : row;

    return (
      <>
        <tr
          ref={this.logLineRef}
          className={logRowBackground}
          onMouseEnter={this.onMouseEnter}
          onMouseLeave={this.onMouseLeave}
          onMouseUp={() => {
            if (!window.getSelection()?.toString()) {
              this.toggleDetails();
            }
          }}
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
