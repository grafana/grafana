import { css, cx } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
export const ResultItem = React.forwardRef(({ action, active, currentRootActionId, }, ref) => {
    const ancestors = React.useMemo(() => {
        if (!currentRootActionId) {
            return action.ancestors;
        }
        const index = action.ancestors.findIndex((ancestor) => ancestor.id === currentRootActionId);
        // +1 removes the currentRootAction; e.g.
        // if we are on the "Set theme" parent action,
        // the UI should not display "Set theme… > Dark"
        // but rather just "Dark"
        return action.ancestors.slice(index + 1);
    }, [action.ancestors, currentRootActionId]);
    const styles = useStyles2(getResultItemStyles);
    let name = action.name;
    const hasCommandOrLink = (action) => { var _a; 
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return Boolean(((_a = action.command) === null || _a === void 0 ? void 0 : _a.perform) || action.url); };
    // TODO: does this needs adjusting for i18n?
    if (action.children.length && !hasCommandOrLink(action) && !name.endsWith('...')) {
        name += '...';
    }
    return (React.createElement("div", { ref: ref, className: cx(styles.row, active && styles.activeRow) },
        React.createElement("div", { className: styles.actionContainer },
            action.icon,
            React.createElement("div", { className: styles.textContainer },
                ancestors.map((ancestor) => (React.createElement(React.Fragment, { key: ancestor.id }, !hasCommandOrLink(ancestor) && (React.createElement(React.Fragment, null,
                    React.createElement("span", { className: styles.breadcrumbAncestor }, ancestor.name),
                    React.createElement("span", { className: styles.breadcrumbSeparator }, "\u203A")))))),
                React.createElement("span", null, name)),
            action.subtitle && React.createElement("span", { className: styles.subtitleText }, action.subtitle))));
});
ResultItem.displayName = 'ResultItem';
const getResultItemStyles = (theme) => {
    return {
        row: css({
            padding: theme.spacing(1, 2),
            display: 'flex',
            alightItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            position: 'relative',
            borderRadius: theme.shape.radius.default,
            margin: theme.spacing(0, 1),
        }),
        activeRow: css({
            color: theme.colors.text.maxContrast,
            background: theme.colors.emphasize(theme.colors.background.primary, 0.03),
            '&:before': {
                display: 'block',
                content: '" "',
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: theme.spacing(0.5),
                borderRadius: theme.shape.radius.default,
                backgroundImage: theme.colors.gradients.brandVertical,
            },
        }),
        actionContainer: css({
            display: 'flex',
            gap: theme.spacing(1),
            alignItems: 'baseline',
            fontSize: theme.typography.fontSize,
            width: '100%',
        }),
        textContainer: css({
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
        }),
        breadcrumbAncestor: css({
            color: theme.colors.text.secondary,
        }),
        breadcrumbSeparator: css({
            color: theme.colors.text.secondary,
            marginLeft: theme.spacing(1),
            marginRight: theme.spacing(1),
        }),
        subtitleText: css(Object.assign(Object.assign({}, theme.typography.bodySmall), { color: theme.colors.text.secondary, display: 'block', flexBasis: '20%', flexGrow: 1, flexShrink: 0, maxWidth: 'fit-content', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })),
    };
};
//# sourceMappingURL=ResultItem.js.map