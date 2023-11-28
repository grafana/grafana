import { css } from '@emotion/css';
import React from 'react';
import Highlighter from 'react-highlight-words';
import { Button, Icon, Tooltip, useTheme2 } from '@grafana/ui';
import { docsTip } from '../../../configuration/ConfigEditor';
import { tracking } from './state/helpers';
export function ResultsTable(props) {
    const { metrics, onChange, onClose, query, state, disableTextWrap } = props;
    const theme = useTheme2();
    const styles = getStyles(theme, disableTextWrap);
    function selectMetric(metric) {
        if (metric.value) {
            onChange(Object.assign(Object.assign({}, query), { metric: metric.value }));
            tracking('grafana_prom_metric_encycopedia_tracking', state, metric.value);
            onClose();
        }
    }
    function metaRows(metric) {
        var _a, _b, _c, _d;
        if (state.fullMetaSearch && metric) {
            return (React.createElement(React.Fragment, null,
                React.createElement("td", null, displayType((_a = metric.type) !== null && _a !== void 0 ? _a : '')),
                React.createElement("td", null,
                    React.createElement(Highlighter, { textToHighlight: (_b = metric.description) !== null && _b !== void 0 ? _b : '', searchWords: state.metaHaystackMatches, autoEscape: true, highlightClassName: styles.matchHighLight }))));
        }
        else {
            return (React.createElement(React.Fragment, null,
                React.createElement("td", null, displayType((_c = metric.type) !== null && _c !== void 0 ? _c : '')),
                React.createElement("td", null, (_d = metric.description) !== null && _d !== void 0 ? _d : '')));
        }
    }
    function addHelpIcon(fullType, descriptiveType, link) {
        return (React.createElement(React.Fragment, null,
            fullType,
            React.createElement("span", { className: styles.tooltipSpace },
                React.createElement(Tooltip, { content: React.createElement(React.Fragment, null,
                        "When creating a ",
                        descriptiveType,
                        ", Prometheus exposes multiple series with the type counter.",
                        ' ',
                        docsTip(link)), placement: "bottom-start", interactive: true },
                    React.createElement(Icon, { name: "info-circle", size: "xs" })))));
    }
    function displayType(type) {
        if (!type) {
            return '';
        }
        if (type.includes('(summary)')) {
            return addHelpIcon(type, 'summary', 'https://prometheus.io/docs/concepts/metric_types/#summary');
        }
        if (type.includes('(histogram)')) {
            return addHelpIcon(type, 'histogram', 'https://prometheus.io/docs/concepts/metric_types/#histogram');
        }
        return type;
    }
    function noMetricsMessages() {
        let message;
        if (!state.fuzzySearchQuery) {
            message = 'There are no metrics found in the data source.';
        }
        if (query.labels.length > 0) {
            message = 'There are no metrics found. Try to expand your label filters.';
        }
        if (state.fuzzySearchQuery || state.selectedTypes.length > 0) {
            message = 'There are no metrics found. Try to expand your search and filters.';
        }
        return (React.createElement("tr", { className: styles.noResults },
            React.createElement("td", { colSpan: 3 }, message)));
    }
    function textHighlight(state) {
        if (state.useBackend) {
            // highlight the input only for the backend search
            // this highlight is equivalent to how the metric select highlights
            // look into matching on regex input
            return [state.fuzzySearchQuery];
        }
        else if (state.fullMetaSearch) {
            // highlight the matches in the ufuzzy metaHaystack
            return state.metaHaystackMatches;
        }
        else {
            // highlight the ufuzzy name matches
            return state.nameHaystackMatches;
        }
    }
    return (React.createElement("table", { className: styles.table },
        React.createElement("thead", { className: styles.stickyHeader },
            React.createElement("tr", null,
                React.createElement("th", { className: `${styles.nameWidth} ${styles.tableHeaderPadding}` }, "Name"),
                state.hasMetadata && (React.createElement(React.Fragment, null,
                    React.createElement("th", { className: `${styles.typeWidth} ${styles.tableHeaderPadding}` }, "Type"),
                    React.createElement("th", { className: `${styles.descriptionWidth} ${styles.tableHeaderPadding}` }, "Description"))),
                React.createElement("th", { className: styles.selectButtonWidth }, " "))),
        React.createElement("tbody", null,
            React.createElement(React.Fragment, null,
                metrics.length > 0 &&
                    metrics.map((metric, idx) => {
                        var _a, _b;
                        return (React.createElement("tr", { key: (_a = metric === null || metric === void 0 ? void 0 : metric.value) !== null && _a !== void 0 ? _a : idx, className: styles.row },
                            React.createElement("td", { className: styles.nameOverflow },
                                React.createElement(Highlighter, { textToHighlight: (_b = metric === null || metric === void 0 ? void 0 : metric.value) !== null && _b !== void 0 ? _b : '', searchWords: textHighlight(state), autoEscape: true, highlightClassName: styles.matchHighLight })),
                            state.hasMetadata && metaRows(metric),
                            React.createElement("td", null,
                                React.createElement(Button, { size: "md", variant: "secondary", onClick: () => selectMetric(metric), className: styles.centerButton }, "Select"))));
                    }),
                metrics.length === 0 && !state.isLoading && noMetricsMessages()))));
}
const getStyles = (theme, disableTextWrap) => {
    return {
        table: css `
      ${disableTextWrap ? '' : 'table-layout: fixed;'}
      border-radius: ${theme.shape.radius.default};
      width: 100%;
      white-space: ${disableTextWrap ? 'nowrap' : 'normal'};
      td {
        padding: ${theme.spacing(1)};
      }

      td,
      th {
        min-width: ${theme.spacing(3)};
        border-bottom: 1px solid ${theme.colors.border.weak};
      }
    `,
        row: css `
      label: row;
      border-bottom: 1px solid ${theme.colors.border.weak}
      &:last-child {
        border-bottom: 0;
      }
    `,
        tableHeaderPadding: css `
      padding: 8px;
    `,
        matchHighLight: css `
      background: inherit;
      color: ${theme.components.textHighlight.text};
      background-color: ${theme.components.textHighlight.background};
    `,
        nameWidth: css `
      ${disableTextWrap ? '' : 'width: 37.5%;'}
    `,
        nameOverflow: css `
      ${disableTextWrap ? '' : 'overflow-wrap: anywhere;'}
    `,
        typeWidth: css `
      ${disableTextWrap ? '' : 'width: 15%;'}
    `,
        descriptionWidth: css `
      ${disableTextWrap ? '' : 'width: 35%;'}
    `,
        selectButtonWidth: css `
      ${disableTextWrap ? '' : 'width: 12.5%;'}
    `,
        stickyHeader: css `
      position: sticky;
      top: 0;
      background-color: ${theme.colors.background.primary};
    `,
        noResults: css `
      text-align: center;
      color: ${theme.colors.text.secondary};
    `,
        tooltipSpace: css `
      margin-left: 4px;
    `,
        centerButton: css `
      display: block;
      margin: auto;
      border: none;
    `,
    };
};
//# sourceMappingURL=ResultsTable.js.map