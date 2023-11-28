import { cx } from '@emotion/css';
import { debounce } from 'lodash';
import React, { PureComponent } from 'react';
import { dateTimeFormat } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { withTheme2, Icon, Tooltip } from '@grafana/ui';
import { checkLogsError, escapeUnescapedString } from '../utils';
import { LogDetails } from './LogDetails';
import { LogLabels } from './LogLabels';
import { LogRowMessage } from './LogRowMessage';
import { LogRowMessageDisplayedFields } from './LogRowMessageDisplayedFields';
import { getLogLevelStyles } from './getLogRowStyles';
/**
 * Renders a log line.
 *
 * When user hovers over it for a certain time, it lazily parses the log line.
 * Once a parser is found, it will determine fields, that will be highlighted.
 * When the user requests stats for a field, they will be calculated and rendered below the row.
 */
class UnThemedLogRow extends PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            permalinked: false,
            showingContext: false,
            showDetails: false,
            mouseIsOver: false,
        };
        // we are debouncing the state change by 3 seconds to highlight the logline after the context closed.
        this.debouncedContextClose = debounce(() => {
            this.setState({ showingContext: false });
        }, 3000);
        this.onOpenContext = (row) => {
            this.setState({ showingContext: true });
            this.props.onOpenContext(row, this.debouncedContextClose);
        };
        this.toggleDetails = () => {
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
        this.onMouseEnter = () => {
            this.setState({ mouseIsOver: true });
            if (this.props.onLogRowHover) {
                this.props.onLogRowHover(this.props.row);
            }
        };
        this.onMouseLeave = () => {
            this.setState({ mouseIsOver: false });
            if (this.props.onLogRowHover) {
                this.props.onLogRowHover(undefined);
            }
        };
        this.scrollToLogRow = (prevState, mounted = false) => {
            var _a;
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
                    datasourceType: (_a = row.datasourceType) !== null && _a !== void 0 ? _a : 'unknown',
                    logRowUid: row.uid,
                });
                this.setState({ permalinked: true });
            }
        };
        this.logLineRef = React.createRef();
    }
    renderTimeStamp(epochMs) {
        return dateTimeFormat(epochMs, {
            timeZone: this.props.timeZone,
            defaultWithMS: true,
        });
    }
    componentDidMount() {
        this.scrollToLogRow(this.state, true);
    }
    componentDidUpdate(_, prevState) {
        this.scrollToLogRow(prevState);
    }
    render() {
        const { getRows, onClickFilterLabel, onClickFilterOutLabel, onClickShowField, onClickHideField, enableLogDetails, row, showDuplicates, showContextToggle, showLabels, showTime, displayedFields, wrapLogMessage, prettifyLogMessage, theme, getFieldLinks, forceEscape, app, styles, } = this.props;
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
        const processedRow = row.hasUnescapedContent && forceEscape
            ? Object.assign(Object.assign({}, row), { entry: escapeUnescapedString(row.entry), raw: escapeUnescapedString(row.raw) }) : row;
        return (React.createElement(React.Fragment, null,
            React.createElement("tr", { ref: this.logLineRef, className: logRowBackground, onClick: this.toggleDetails, onMouseEnter: this.onMouseEnter, onMouseLeave: this.onMouseLeave, 
                /**
                 * For better accessibility support, we listen to the onFocus event here (to display the LogRowMenuCell), and
                 * to onBlur event in the LogRowMenuCell (to hide it). This way, the LogRowMenuCell is displayed when the user navigates
                 * using the keyboard.
                 */
                onFocus: this.onMouseEnter },
                showDuplicates && (React.createElement("td", { className: styles.logsRowDuplicates }, processedRow.duplicates && processedRow.duplicates > 0 ? `${processedRow.duplicates + 1}x` : null)),
                React.createElement("td", { className: hasError ? '' : `${levelStyles.logsRowLevelColor} ${styles.logsRowLevel}` }, hasError && (React.createElement(Tooltip, { content: `Error: ${errorMessage}`, placement: "right", theme: "error" },
                    React.createElement(Icon, { className: styles.logIconError, name: "exclamation-triangle", size: "xs" })))),
                enableLogDetails && (React.createElement("td", { title: showDetails ? 'Hide log details' : 'See log details', className: styles.logsRowToggleDetails },
                    React.createElement(Icon, { className: styles.topVerticalAlign, name: showDetails ? 'angle-down' : 'angle-right' }))),
                showTime && React.createElement("td", { className: styles.logsRowLocalTime }, this.renderTimeStamp(row.timeEpochMs)),
                showLabels && processedRow.uniqueLabels && (React.createElement("td", { className: styles.logsRowLabels },
                    React.createElement(LogLabels, { labels: processedRow.uniqueLabels }))),
                displayedFields && displayedFields.length > 0 ? (React.createElement(LogRowMessageDisplayedFields, { row: processedRow, showContextToggle: showContextToggle, detectedFields: displayedFields, getFieldLinks: getFieldLinks, wrapLogMessage: wrapLogMessage, onOpenContext: this.onOpenContext, onPermalinkClick: this.props.onPermalinkClick, styles: styles, onPinLine: this.props.onPinLine, onUnpinLine: this.props.onUnpinLine, pinned: this.props.pinned, mouseIsOver: this.state.mouseIsOver, onBlur: this.onMouseLeave })) : (React.createElement(LogRowMessage, { row: processedRow, showContextToggle: showContextToggle, wrapLogMessage: wrapLogMessage, prettifyLogMessage: prettifyLogMessage, onOpenContext: this.onOpenContext, onPermalinkClick: this.props.onPermalinkClick, app: app, styles: styles, onPinLine: this.props.onPinLine, onUnpinLine: this.props.onUnpinLine, pinned: this.props.pinned, mouseIsOver: this.state.mouseIsOver, onBlur: this.onMouseLeave }))),
            this.state.showDetails && (React.createElement(LogDetails, { className: logRowDetailsBackground, showDuplicates: showDuplicates, getFieldLinks: getFieldLinks, onClickFilterLabel: onClickFilterLabel, onClickFilterOutLabel: onClickFilterOutLabel, onClickShowField: onClickShowField, onClickHideField: onClickHideField, getRows: getRows, row: processedRow, wrapLogMessage: wrapLogMessage, hasError: hasError, displayedFields: displayedFields, app: app, styles: styles, isFilterLabelActive: this.props.isFilterLabelActive }))));
    }
}
export const LogRow = withTheme2(UnThemedLogRow);
LogRow.displayName = 'LogRow';
//# sourceMappingURL=LogRow.js.map