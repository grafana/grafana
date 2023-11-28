import { css, cx } from '@emotion/css';
import React from 'react';
import { useToggle } from 'react-use';
import { CoreApp } from '@grafana/data';
import { Icon, useStyles2, RadioButtonGroup, MultiSelect, Input, clearButtonStyles, Button } from '@grafana/ui';
import { EditorField } from './EditorField';
import { Stack } from './Stack';
const typeOptions = [
    { value: 'metrics', label: 'Metric', description: 'Return aggregated metrics' },
    { value: 'profile', label: 'Profile', description: 'Return profile' },
    { value: 'both', label: 'Both', description: 'Return both metric and profile data' },
];
function getTypeOptions(app) {
    if (app === CoreApp.Explore) {
        return typeOptions;
    }
    return typeOptions.filter((option) => option.value !== 'both');
}
/**
 * Base on QueryOptionGroup component from grafana/ui but that is not available yet.
 */
export function QueryOptions({ query, onQueryChange, app, labels }) {
    var _a;
    const [isOpen, toggleOpen] = useToggle(false);
    const styles = useStyles2(getStyles);
    const typeOptions = getTypeOptions(app);
    const groupByOptions = labels
        ? labels.map((l) => ({
            label: l,
            value: l,
        }))
        : [];
    const buttonStyles = useStyles2(clearButtonStyles);
    return (React.createElement(Stack, { gap: 0, direction: "column" },
        React.createElement(Button, { className: cx(styles.header, buttonStyles), onClick: toggleOpen, title: "Click to edit options" },
            React.createElement("div", { className: styles.toggle },
                React.createElement(Icon, { name: isOpen ? 'angle-down' : 'angle-right' })),
            React.createElement("h6", { className: styles.title }, "Options"),
            !isOpen && (React.createElement("div", { className: styles.description }, [`Type: ${query.queryType}`, ((_a = query.groupBy) === null || _a === void 0 ? void 0 : _a.length) ? `Group by: ${query.groupBy.join(', ')}` : undefined]
                .filter((v) => v)
                .map((v, i) => (React.createElement("span", { key: i }, v)))))),
        isOpen && (React.createElement("div", { className: styles.body },
            React.createElement(EditorField, { label: 'Query Type' },
                React.createElement(RadioButtonGroup, { options: typeOptions, value: query.queryType, onChange: (value) => onQueryChange(Object.assign(Object.assign({}, query), { queryType: value })) })),
            React.createElement(EditorField, { label: 'Group by', tooltip: React.createElement(React.Fragment, null, "Used to group the metric result by a specific label or set of labels. Does not apply to profile query.") },
                React.createElement(MultiSelect, { placeholder: "Label", value: query.groupBy, allowCustomValue: true, options: groupByOptions, onChange: (change) => {
                        const changes = change.map((c) => {
                            return c.value;
                        });
                        onQueryChange(Object.assign(Object.assign({}, query), { groupBy: changes }));
                    } })),
            React.createElement(EditorField, { label: 'Max Nodes', tooltip: React.createElement(React.Fragment, null, "Sets the maximum number of nodes to return in the flamegraph.") },
                React.createElement(Input, { value: query.maxNodes || '', type: "number", placeholder: "16384", onChange: (event) => {
                        let newValue = parseInt(event.currentTarget.value, 10);
                        newValue = isNaN(newValue) ? 0 : newValue;
                        onQueryChange(Object.assign(Object.assign({}, query), { maxNodes: newValue }));
                    } }))))));
}
const getStyles = (theme) => {
    return {
        switchLabel: css({
            color: theme.colors.text.secondary,
            cursor: 'pointer',
            fontSize: theme.typography.bodySmall.fontSize,
            '&:hover': {
                color: theme.colors.text.primary,
            },
        }),
        header: css({
            display: 'flex',
            cursor: 'pointer',
            alignItems: 'baseline',
            color: theme.colors.text.primary,
            '&:hover': {
                background: theme.colors.emphasize(theme.colors.background.primary, 0.03),
            },
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
            paddingLeft: theme.spacing(2),
            gap: theme.spacing(2),
            display: 'flex',
        }),
        body: css({
            display: 'flex',
            paddingTop: theme.spacing(2),
            gap: theme.spacing(2),
            flexWrap: 'wrap',
        }),
        toggle: css({
            color: theme.colors.text.secondary,
            marginRight: `${theme.spacing(1)}`,
        }),
    };
};
//# sourceMappingURL=QueryOptions.js.map