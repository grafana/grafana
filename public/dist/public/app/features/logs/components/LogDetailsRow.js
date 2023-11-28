import { __awaiter, __rest } from "tslib";
import { css, cx } from '@emotion/css';
import { isEqual } from 'lodash';
import memoizeOne from 'memoize-one';
import React, { PureComponent, useState } from 'react';
import { config, reportInteraction } from '@grafana/runtime';
import { ClipboardButton, DataLinkButton, IconButton, withTheme2 } from '@grafana/ui';
import { LogLabelStats } from './LogLabelStats';
import { getLogRowStyles } from './getLogRowStyles';
const getStyles = memoizeOne((theme) => {
    return {
        wordBreakAll: css `
      label: wordBreakAll;
      word-break: break-all;
    `,
        copyButton: css `
      & > button {
        color: ${theme.colors.text.secondary};
        padding: 0;
        justify-content: center;
        border-radius: ${theme.shape.radius.circle};
        height: ${theme.spacing(theme.components.height.sm)};
        width: ${theme.spacing(theme.components.height.sm)};
        svg {
          margin: 0;
        }

        span > div {
          top: -5px;
          & button {
            color: ${theme.colors.success.main};
          }
        }
      }
    `,
        adjoiningLinkButton: css `
      margin-left: ${theme.spacing(1)};
    `,
        wrapLine: css `
      label: wrapLine;
      white-space: pre-wrap;
    `,
        logDetailsStats: css `
      padding: 0 ${theme.spacing(1)};
    `,
        logDetailsValue: css `
      display: flex;
      align-items: center;
      line-height: 22px;

      .log-details-value-copy {
        visibility: hidden;
      }
      &:hover {
        .log-details-value-copy {
          visibility: visible;
        }
      }
    `,
        buttonRow: css `
      display: flex;
      flex-direction: row;
      gap: ${theme.spacing(0.5)};
      margin-left: ${theme.spacing(0.5)};
    `,
    };
});
class UnThemedLogDetailsRow extends PureComponent {
    constructor() {
        super(...arguments);
        this.state = {
            showFieldsStats: false,
            fieldCount: 0,
            fieldStats: null,
        };
        this.showField = () => {
            const { onClickShowField: onClickShowDetectedField, parsedKeys, row } = this.props;
            if (onClickShowDetectedField) {
                onClickShowDetectedField(parsedKeys[0]);
            }
            reportInteraction('grafana_explore_logs_log_details_replace_line_clicked', {
                datasourceType: row.datasourceType,
                logRowUid: row.uid,
                type: 'enable',
            });
        };
        this.hideField = () => {
            const { onClickHideField: onClickHideDetectedField, parsedKeys, row } = this.props;
            if (onClickHideDetectedField) {
                onClickHideDetectedField(parsedKeys[0]);
            }
            reportInteraction('grafana_explore_logs_log_details_replace_line_clicked', {
                datasourceType: row.datasourceType,
                logRowUid: row.uid,
                type: 'disable',
            });
        };
        this.isFilterLabelActive = () => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { isFilterLabelActive, parsedKeys, parsedValues, row } = this.props;
            if (isFilterLabelActive) {
                return yield isFilterLabelActive(parsedKeys[0], parsedValues[0], (_a = row.dataFrame) === null || _a === void 0 ? void 0 : _a.refId);
            }
            return false;
        });
        this.filterLabel = () => {
            var _a;
            const { onClickFilterLabel, parsedKeys, parsedValues, row } = this.props;
            if (onClickFilterLabel) {
                onClickFilterLabel(parsedKeys[0], parsedValues[0], (_a = row.dataFrame) === null || _a === void 0 ? void 0 : _a.refId);
            }
            reportInteraction('grafana_explore_logs_log_details_filter_clicked', {
                datasourceType: row.datasourceType,
                filterType: 'include',
                logRowUid: row.uid,
            });
        };
        this.filterOutLabel = () => {
            var _a;
            const { onClickFilterOutLabel, parsedKeys, parsedValues, row } = this.props;
            if (onClickFilterOutLabel) {
                onClickFilterOutLabel(parsedKeys[0], parsedValues[0], (_a = row.dataFrame) === null || _a === void 0 ? void 0 : _a.refId);
            }
            reportInteraction('grafana_explore_logs_log_details_filter_clicked', {
                datasourceType: row.datasourceType,
                filterType: 'exclude',
                logRowUid: row.uid,
            });
        };
        this.updateStats = () => {
            const { getStats } = this.props;
            const fieldStats = getStats();
            const fieldCount = fieldStats ? fieldStats.reduce((sum, stat) => sum + stat.count, 0) : 0;
            if (!isEqual(this.state.fieldStats, fieldStats) || fieldCount !== this.state.fieldCount) {
                this.setState({ fieldStats, fieldCount });
            }
        };
        this.showStats = () => {
            const { isLabel, row, app } = this.props;
            const { showFieldsStats } = this.state;
            if (!showFieldsStats) {
                this.updateStats();
            }
            this.toggleFieldsStats();
            reportInteraction('grafana_explore_logs_log_details_stats_clicked', {
                dataSourceType: row.datasourceType,
                fieldType: isLabel ? 'label' : 'detectedField',
                type: showFieldsStats ? 'close' : 'open',
                logRowUid: row.uid,
                app,
            });
        };
    }
    componentDidUpdate() {
        if (this.state.showFieldsStats) {
            this.updateStats();
        }
    }
    toggleFieldsStats() {
        this.setState((state) => {
            return {
                showFieldsStats: !state.showFieldsStats,
            };
        });
    }
    generateClipboardButton(val) {
        const { theme } = this.props;
        const styles = getStyles(theme);
        return (React.createElement("div", { className: `log-details-value-copy ${styles.copyButton}` },
            React.createElement(ClipboardButton, { getText: () => val, title: "Copy value to clipboard", fill: "text", variant: "secondary", icon: "copy", size: "md" })));
    }
    generateMultiVal(value, showCopy) {
        return (React.createElement("table", null,
            React.createElement("tbody", null, value === null || value === void 0 ? void 0 : value.map((val, i) => {
                return (React.createElement("tr", { key: `${val}-${i}` },
                    React.createElement("td", null,
                        val,
                        showCopy && val !== '' && this.generateClipboardButton(val))));
            }))));
    }
    render() {
        var _a, _b;
        const { theme, parsedKeys, parsedValues, isLabel, links, displayedFields, wrapLogMessage, onClickFilterLabel, onClickFilterOutLabel, disableActions, row, } = this.props;
        const { showFieldsStats, fieldStats, fieldCount } = this.state;
        const styles = getStyles(theme);
        const rowStyles = getLogRowStyles(theme);
        const singleKey = parsedKeys == null ? false : parsedKeys.length === 1;
        const singleVal = parsedValues == null ? false : parsedValues.length === 1;
        const hasFilteringFunctionality = !disableActions && onClickFilterLabel && onClickFilterOutLabel;
        const refIdTooltip = config.featureToggles.toggleLabelsInLogsUI && ((_a = row.dataFrame) === null || _a === void 0 ? void 0 : _a.refId) ? ` in query ${(_b = row.dataFrame) === null || _b === void 0 ? void 0 : _b.refId}` : '';
        const isMultiParsedValueWithNoContent = !singleVal && parsedValues != null && !parsedValues.every((val) => val === '');
        const toggleFieldButton = displayedFields && parsedKeys != null && displayedFields.includes(parsedKeys[0]) ? (React.createElement(IconButton, { variant: "primary", tooltip: "Hide this field", name: "eye", onClick: this.hideField })) : (React.createElement(IconButton, { tooltip: "Show this field instead of the message", name: "eye", onClick: this.showField }));
        return (React.createElement(React.Fragment, null,
            React.createElement("tr", { className: rowStyles.logDetailsValue },
                React.createElement("td", { className: rowStyles.logsDetailsIcon },
                    React.createElement("div", { className: styles.buttonRow },
                        hasFilteringFunctionality && (React.createElement(React.Fragment, null,
                            config.featureToggles.toggleLabelsInLogsUI ? (
                            // If we are using the new label toggling, we want to use the async icon button
                            React.createElement(AsyncIconButton, { name: "search-plus", onClick: this.filterLabel, isActive: this.isFilterLabelActive, tooltipSuffix: refIdTooltip })) : (React.createElement(IconButton, { name: "search-plus", onClick: this.filterLabel, tooltip: "Filter for value" })),
                            React.createElement(IconButton, { name: "search-minus", tooltip: `Filter out value${refIdTooltip}`, onClick: this.filterOutLabel }))),
                        !disableActions && displayedFields && toggleFieldButton,
                        !disableActions && (React.createElement(IconButton, { variant: showFieldsStats ? 'primary' : 'secondary', name: "signal", tooltip: "Ad-hoc statistics", className: "stats-button", disabled: !singleKey, onClick: this.showStats })))),
                React.createElement("td", { className: rowStyles.logDetailsLabel }, singleKey ? parsedKeys[0] : this.generateMultiVal(parsedKeys)),
                React.createElement("td", { className: cx(styles.wordBreakAll, wrapLogMessage && styles.wrapLine) },
                    React.createElement("div", { className: styles.logDetailsValue },
                        singleVal ? parsedValues[0] : this.generateMultiVal(parsedValues, true),
                        singleVal && this.generateClipboardButton(parsedValues[0]),
                        React.createElement("div", { className: cx((singleVal || isMultiParsedValueWithNoContent) && styles.adjoiningLinkButton) }, links === null || links === void 0 ? void 0 : links.map((link, i) => (React.createElement("span", { key: `${link.title}-${i}` },
                            React.createElement(DataLinkButton, { link: link })))))))),
            showFieldsStats && singleKey && singleVal && (React.createElement("tr", null,
                React.createElement("td", null,
                    React.createElement(IconButton, { variant: showFieldsStats ? 'primary' : 'secondary', name: "signal", tooltip: "Hide ad-hoc statistics", onClick: this.showStats })),
                React.createElement("td", { colSpan: 2 },
                    React.createElement("div", { className: styles.logDetailsStats },
                        React.createElement(LogLabelStats, { stats: fieldStats, label: parsedKeys[0], value: parsedValues[0], rowCount: fieldCount, isLabel: isLabel })))))));
    }
}
const AsyncIconButton = (_a) => {
    var { isActive, tooltipSuffix } = _a, rest = __rest(_a, ["isActive", "tooltipSuffix"]);
    const [active, setActive] = useState(false);
    const tooltip = active ? 'Remove filter' : 'Filter for value';
    /**
     * We purposely want to run this on every render to allow the active state to be updated
     * when log details remains open between updates.
     */
    isActive().then(setActive);
    return React.createElement(IconButton, Object.assign({}, rest, { variant: active ? 'primary' : undefined, tooltip: tooltip + tooltipSuffix }));
};
export const LogDetailsRow = withTheme2(UnThemedLogDetailsRow);
LogDetailsRow.displayName = 'LogDetailsRow';
//# sourceMappingURL=LogDetailsRow.js.map