import { css } from '@emotion/css';
import React from 'react';
import { useToggle } from 'react-use';
import { getValueFormat } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Collapse, Icon, Tooltip, useStyles2 } from '@grafana/ui';
export function QueryOptionGroup({ title, children, collapsedInfo, queryStats }) {
    const [isOpen, toggleOpen] = useToggle(false);
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement(Collapse, { className: styles.collapse, collapsible: true, isOpen: isOpen, onToggle: toggleOpen, label: React.createElement(Stack, { gap: 0, wrap: false },
                React.createElement("h6", { className: styles.title }, title),
                !isOpen && (React.createElement("div", { className: styles.description }, collapsedInfo.map((x, i) => (React.createElement("span", { key: i }, x)))))) },
            React.createElement("div", { className: styles.body }, children)),
        queryStats && config.featureToggles.lokiQuerySplitting && (React.createElement(Tooltip, { content: "Note: the query will be split into multiple parts and executed in sequence. Query limits will only apply each individual part." },
            React.createElement(Icon, { tabIndex: 0, name: "info-circle", className: styles.tooltip, size: "sm" }))),
        queryStats && React.createElement("p", { className: styles.stats }, generateQueryStats(queryStats))));
}
const getStyles = (theme) => {
    return {
        collapse: css({
            backgroundColor: 'unset',
            border: 'unset',
            marginBottom: 0,
            ['> button']: {
                padding: theme.spacing(0, 1),
            },
        }),
        wrapper: css({
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
        }),
        title: css({
            flexGrow: 1,
            overflow: 'hidden',
            fontSize: theme.typography.bodySmall.fontSize,
            fontWeight: theme.typography.fontWeightMedium,
            margin: 0,
        }),
        description: css({
            color: theme.colors.text.secondary,
            fontSize: theme.typography.bodySmall.fontSize,
            fontWeight: theme.typography.bodySmall.fontWeight,
            paddingLeft: theme.spacing(2),
            gap: theme.spacing(2),
            display: 'flex',
        }),
        body: css({
            display: 'flex',
            gap: theme.spacing(2),
            flexWrap: 'wrap',
        }),
        stats: css({
            margin: '0px',
            color: theme.colors.text.secondary,
            fontSize: theme.typography.bodySmall.fontSize,
        }),
        tooltip: css({
            marginRight: theme.spacing(0.25),
        }),
    };
};
const generateQueryStats = (queryStats) => {
    if (queryStats.message) {
        return queryStats.message;
    }
    return `This query will process approximately ${convertUnits(queryStats)}.`;
};
const convertUnits = (queryStats) => {
    const { text, suffix } = getValueFormat('bytes')(queryStats.bytes, 1);
    return text + suffix;
};
//# sourceMappingURL=QueryOptionGroup.js.map