import { cx } from '@emotion/css';
import { debounce } from 'lodash';
import React, { PureComponent } from 'react';

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
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
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
  scrollIntoView: (element: HTMLElement) => void;
}

interface State {
  highlightBackround: boolean;
  showDetails: boolean;
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
    highlightBackround: false,
    showDetails: false,
  };

  // we are debouncing the state change by 3 seconds to highlight the logline after the context closed.
  debouncedContextClose = debounce(() => {
    this.setState({ highlightBackround: false });
  }, 3000);

  onOpenContext = (row: LogRowModel) => {
    this.setState({ highlightBackround: true });
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
  logLineRef: React.RefObject<HTMLTableRowElement>;

  renderTimeStamp(epochMs: number) {
    return dateTimeFormat(epochMs, {
      timeZone: this.props.timeZone,
      defaultWithMS: true,
    });
  }

  onMouseEnter = () => {
    if (this.props.onLogRowHover) {
      this.props.onLogRowHover(this.props.row);
    }
  };

  onMouseLeave = () => {
    if (this.props.onLogRowHover) {
      this.props.onLogRowHover(undefined);
    }
  };

  constructor(props: Props) {
    super(props);
    this.logLineRef = React.createRef();
  }

  componentDidMount() {
    this.scrollToLogRow();
  }

  componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<State>): void {
    if (
      this.props.permalinkedRowId !== prevProps.permalinkedRowId &&
      this.props.permalinkedRowId !== this.props.row.uid
    ) {
      this.setState({ highlightBackround: false });
    } else if (this.props.permalinkedRowId === this.props.row.uid && !this.state.highlightBackround) {
      this.scrollToLogRow();
    }
  }

  scrollToLogRow = () => {
    if (this.logLineRef.current && this.props.permalinkedRowId === this.props.row.uid) {
      this.props.scrollIntoView(this.logLineRef.current);
      this.setState({ highlightBackround: true });
    } else {
      this.setState({ highlightBackround: false });
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
    const { showDetails, highlightBackround } = this.state;
    const levelStyles = getLogLevelStyles(theme, row.logLevel);
    const { errorMessage, hasError } = checkLogsError(row);
    const logRowBackground = cx(styles.logsRow, {
      [styles.errorLogRow]: hasError,
      [styles.highlightBackground]: highlightBackround,
    });
    const logRowDetailsBackground = cx(styles.logsRow, {
      [styles.errorLogRow]: hasError,
      [styles.highlightBackground]: highlightBackround && !this.state.showDetails,
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
          onClick={this.toggleDetails}
          onMouseEnter={this.onMouseEnter}
          onMouseLeave={this.onMouseLeave}
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
              showDetectedFields={displayedFields!}
              getFieldLinks={getFieldLinks}
              wrapLogMessage={wrapLogMessage}
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
              permalinkedRowId={this.props.permalinkedRowId}
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
          />
        )}
      </>
    );
  }
}

export const LogRow = withTheme2(UnThemedLogRow);
LogRow.displayName = 'LogRow';
