import { css } from '@emotion/css';
import { formatDistanceToNowStrict } from 'date-fns';
import { groupBy, uniqueId } from 'lodash';
import React, { useEffect } from 'react';
import { dateTimeFormat } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Icon, TagList, useStyles2 } from '@grafana/ui';
import { Label } from '../../Label';
import { AlertStateTag } from '../AlertStateTag';
import { omitLabels } from './common';
function groupRecordsByTimestamp(records) {
    // groupBy has been replaced by the reduce to avoid back and forth conversion of timestamp from number to string
    const groupedLines = records.reduce((acc, current) => {
        const tsGroup = acc.get(current.timestamp);
        if (tsGroup) {
            tsGroup.push(current);
        }
        else {
            acc.set(current.timestamp, [current]);
        }
        return acc;
    }, new Map());
    return new Map([...groupedLines].sort((a, b) => b[0] - a[0]));
}
export const LogRecordViewerByTimestamp = React.memo(({ records, commonLabels, onLabelClick, onRecordsRendered }) => {
    const styles = useStyles2(getStyles);
    const groupedLines = groupRecordsByTimestamp(records);
    const timestampRefs = new Map();
    useEffect(() => {
        onRecordsRendered && onRecordsRendered(timestampRefs);
    });
    return (React.createElement("ul", { className: styles.logsScrollable, "aria-label": "State history by timestamp" }, Array.from(groupedLines.entries()).map(([key, records]) => {
        return (React.createElement("li", { id: key.toString(10), key: key, "data-testid": key, ref: (element) => element && timestampRefs.set(key, element), className: styles.listItemWrapper },
            React.createElement(Timestamp, { time: key }),
            React.createElement("div", { className: styles.logsContainer }, records.map(({ line }) => (React.createElement(React.Fragment, { key: uniqueId() },
                React.createElement(AlertStateTag, { state: line.previous, size: "sm", muted: true }),
                React.createElement(Icon, { name: "arrow-right", size: "sm" }),
                React.createElement(AlertStateTag, { state: line.current }),
                React.createElement(Stack, { direction: "row" }, line.values && React.createElement(AlertInstanceValues, { record: line.values })),
                React.createElement("div", null, line.labels && (React.createElement(TagList, { tags: omitLabels(Object.entries(line.labels), commonLabels).map(([key, value]) => `${key}=${value}`), onClick: onLabelClick })))))))));
    })));
});
LogRecordViewerByTimestamp.displayName = 'LogRecordViewerByTimestamp';
export function LogRecordViewerByInstance({ records, commonLabels }) {
    const styles = useStyles2(getStyles);
    const groupedLines = groupBy(records, (record) => {
        return JSON.stringify(record.line.labels);
    });
    return (React.createElement(React.Fragment, null, Object.entries(groupedLines).map(([key, records]) => {
        var _a;
        return (React.createElement(Stack, { direction: "column", key: key },
            React.createElement("h4", null,
                React.createElement(TagList, { tags: omitLabels(Object.entries((_a = records[0].line.labels) !== null && _a !== void 0 ? _a : {}), commonLabels).map(([key, value]) => `${key}=${value}`) })),
            React.createElement("div", { className: styles.logsContainer }, records.map(({ line, timestamp }) => (React.createElement("div", { key: uniqueId() },
                React.createElement(AlertStateTag, { state: line.previous, size: "sm", muted: true }),
                React.createElement(Icon, { name: "arrow-right", size: "sm" }),
                React.createElement(AlertStateTag, { state: line.current }),
                React.createElement(Stack, { direction: "row" }, line.values && React.createElement(AlertInstanceValues, { record: line.values })),
                React.createElement("div", null, dateTimeFormat(timestamp))))))));
    })));
}
const Timestamp = ({ time }) => {
    const dateTime = new Date(time);
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.timestampWrapper },
        React.createElement(Stack, { direction: "row", alignItems: "center", gap: 1 },
            React.createElement(Icon, { name: "clock-nine", size: "sm" }),
            React.createElement("span", { className: styles.timestampText }, dateTimeFormat(dateTime)),
            React.createElement("small", null,
                "(",
                formatDistanceToNowStrict(dateTime),
                " ago)"))));
};
const AlertInstanceValues = React.memo(({ record }) => {
    const values = Object.entries(record);
    return (React.createElement(React.Fragment, null, values.map(([key, value]) => (React.createElement(Label, { key: key, label: key, value: value })))));
});
AlertInstanceValues.displayName = 'AlertInstanceValues';
const getStyles = (theme) => ({
    logsContainer: css `
    display: grid;
    grid-template-columns: max-content max-content max-content auto max-content;
    gap: ${theme.spacing(2, 1)};
    align-items: center;
  `,
    logsScrollable: css `
    height: 500px;
    overflow: scroll;

    flex: 1;
  `,
    timestampWrapper: css `
    color: ${theme.colors.text.secondary};
  `,
    timestampText: css `
    color: ${theme.colors.text.primary};
    font-size: ${theme.typography.bodySmall.fontSize};
    font-weight: ${theme.typography.fontWeightBold};
  `,
    listItemWrapper: css `
    background: transparent;
    outline: 1px solid transparent;

    transition:
      background 150ms,
      outline 150ms;
    padding: ${theme.spacing(1)} ${theme.spacing(1.5)};
  `,
});
//# sourceMappingURL=LogRecordViewer.js.map