import { css } from '@emotion/css';
import { groupBy } from 'lodash';
import React, { useCallback, useState } from 'react';
import { dateTimeFormat } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Alert, Field, Icon, Input, Label, LoadingPlaceholder, Tooltip, useStyles2 } from '@grafana/ui';
import { useManagedAlertStateHistory } from '../../../hooks/useManagedAlertStateHistory';
import { AlertLabel } from '../../AlertLabel';
import { DynamicTable } from '../../DynamicTable';
import { AlertStateTag } from '../AlertStateTag';
const StateHistory = ({ alertId }) => {
    const [textFilter, setTextFilter] = useState('');
    const handleTextFilter = useCallback((event) => {
        setTextFilter(event.currentTarget.value);
    }, []);
    const { loading, error, result = [] } = useManagedAlertStateHistory(alertId);
    const styles = useStyles2(getStyles);
    if (loading && !error) {
        return React.createElement(LoadingPlaceholder, { text: 'Loading history...' });
    }
    if (error && !loading) {
        return React.createElement(Alert, { title: 'Failed to fetch alert state history' }, error.message);
    }
    const columns = [
        { id: 'state', label: 'State', size: 'max-content', renderCell: renderStateCell },
        { id: 'value', label: '', size: 'auto', renderCell: renderValueCell },
        { id: 'timestamp', label: 'Time', size: 'max-content', renderCell: renderTimestampCell },
    ];
    // group the state history list by unique set of labels
    const tables = Object.entries(groupStateByLabels(result))
        // sort and filter each table
        .sort()
        .filter(([groupKey]) => matchKey(groupKey, textFilter))
        .map(([groupKey, items]) => {
        const tableItems = items.map((historyItem) => ({
            id: historyItem.id,
            data: historyItem,
        }));
        return (React.createElement("div", { key: groupKey },
            React.createElement("header", { className: styles.tableGroupKey },
                React.createElement("code", null, groupKey)),
            React.createElement(DynamicTable, { cols: columns, items: tableItems, pagination: { itemsPerPage: 25 } })));
    });
    return (React.createElement("div", null,
        React.createElement("nav", null,
            React.createElement(Field, { label: React.createElement(Label, null,
                    React.createElement(Stack, { gap: 0.5 },
                        React.createElement("span", null, "Filter group"),
                        React.createElement(Tooltip, { content: React.createElement("div", null,
                                "Filter each state history group either by exact match or a regular expression, ex:",
                                ' ',
                                React.createElement("code", null, `region=eu-west-1`),
                                " or ",
                                React.createElement("code", null, `/region=us-.+/`)) },
                            React.createElement(Icon, { name: "info-circle", size: "sm" })))) },
                React.createElement(Input, { prefix: React.createElement(Icon, { name: 'search' }), onChange: handleTextFilter, placeholder: "Search" }))),
        tables));
};
// group state history by labels
export function groupStateByLabels(history) {
    const items = history.map((item) => {
        var _a, _b;
        // let's grab the last matching set of `{<string>}` since the alert name could also contain { or }
        const LABELS_REGEX = /{.*?}/g;
        const stringifiedLabels = (_b = (_a = item.text.match(LABELS_REGEX)) === null || _a === void 0 ? void 0 : _a.at(-1)) !== null && _b !== void 0 ? _b : '';
        return {
            id: String(item.id),
            state: item.newState,
            // let's omit the labels for each entry since it's just added noise to each state history item
            text: item.text.replace(stringifiedLabels, ''),
            data: item.data,
            timestamp: item.updated,
            stringifiedLabels,
        };
    });
    // we have to group our state history items by their unique combination of tags since we want to display a DynamicTable for each alert instance
    // (effectively unique combination of labels)
    return groupBy(items, (item) => item.stringifiedLabels);
}
// match a string either by exact text match or with regular expression when in the form of "/<regex>/"
export function matchKey(groupKey, textFilter) {
    // if the text filter is empty we show all matches
    if (textFilter === '') {
        return true;
    }
    const isRegExp = textFilter.startsWith('/') && textFilter.endsWith('/');
    // not a regular expression, use normal text matching
    if (!isRegExp) {
        return groupKey.includes(textFilter);
    }
    // regular expression, try parsing and applying
    // when we fail to parse the text as a regular expression, we return no match
    try {
        return new RegExp(textFilter.slice(1, -1)).test(groupKey);
    }
    catch (err) {
        return false;
    }
}
function renderValueCell(item) {
    var _a, _b;
    const matches = (_b = (_a = item.data.data) === null || _a === void 0 ? void 0 : _a.evalMatches) !== null && _b !== void 0 ? _b : [];
    return (React.createElement(React.Fragment, null,
        item.data.text,
        React.createElement(LabelsWrapper, null, matches.map((match) => (React.createElement(AlertLabel, { key: match.metric, labelKey: match.metric, value: String(match.value) }))))));
}
function renderStateCell(item) {
    return React.createElement(AlertStateTag, { state: item.data.state });
}
function renderTimestampCell(item) {
    return (React.createElement("div", { className: TimestampStyle }, item.data.timestamp && React.createElement("span", null, dateTimeFormat(item.data.timestamp))));
}
const LabelsWrapper = ({ children }) => {
    const { wrapper } = useStyles2(getStyles);
    return React.createElement("div", { className: wrapper }, children);
};
const TimestampStyle = css `
  display: flex;
  align-items: flex-end;
  flex-direction: column;
`;
const getStyles = (theme) => ({
    wrapper: css `
    & > * {
      margin-right: ${theme.spacing(1)};
    }
  `,
    tableGroupKey: css `
    margin-top: ${theme.spacing(2)};
    margin-bottom: ${theme.spacing(2)};
  `,
});
export default StateHistory;
//# sourceMappingURL=StateHistory.js.map