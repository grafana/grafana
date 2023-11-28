import { css, cx } from '@emotion/css';
import React from 'react';
import { useToggle } from 'react-use';
import { CoreApp } from '@grafana/data';
import { Icon, useStyles2, RadioButtonGroup, Field, clearButtonStyles, Button } from '@grafana/ui';
import { Stack } from './Stack';
const rangeOptions = [
    { value: 'metrics', label: 'Metric', description: 'Return aggregated metrics' },
    { value: 'profile', label: 'Profile', description: 'Return profile' },
    { value: 'both', label: 'Both', description: 'Return both metric and profile data' },
];
function getOptions(app) {
    if (app === CoreApp.Explore) {
        return rangeOptions;
    }
    return rangeOptions.filter((option) => option.value !== 'both');
}
/**
 * Base on QueryOptionGroup component from grafana/ui but that is not available yet.
 */
export function QueryOptions({ query, onQueryTypeChange, app }) {
    const [isOpen, toggleOpen] = useToggle(false);
    const styles = useStyles2(getStyles);
    const options = getOptions(app);
    const buttonStyles = useStyles2(clearButtonStyles);
    return (React.createElement(Stack, { gap: 0, direction: "column" },
        React.createElement(Button, { className: cx(styles.header, buttonStyles), onClick: toggleOpen, title: "Click to edit options" },
            React.createElement("div", { className: styles.toggle },
                React.createElement(Icon, { name: isOpen ? 'angle-down' : 'angle-right' })),
            React.createElement("h6", { className: styles.title }, "Options"),
            !isOpen && (React.createElement("div", { className: styles.description },
                React.createElement("span", null,
                    "Type: ",
                    query.queryType)))),
        isOpen && (React.createElement("div", { className: styles.body },
            React.createElement(Field, { label: 'Query Type' },
                React.createElement(RadioButtonGroup, { options: options, value: query.queryType, onChange: onQueryTypeChange }))))));
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