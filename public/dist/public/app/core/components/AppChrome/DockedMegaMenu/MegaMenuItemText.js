import { css, cx } from '@emotion/css';
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Icon, Link, useTheme2 } from '@grafana/ui';
export function MegaMenuItemText({ children, isActive, onClick, target, url }) {
    const theme = useTheme2();
    const styles = getStyles(theme, isActive);
    const linkContent = (React.createElement("div", { className: styles.linkContent },
        children,
        target === '_blank' && (React.createElement(Icon, { "data-testid": "external-link-icon", name: "external-link-alt", className: styles.externalLinkIcon }))));
    let element = (React.createElement("button", { "data-testid": selectors.components.NavMenu.item, className: cx(styles.button, styles.element), onClick: onClick }, linkContent));
    if (url) {
        element =
            !target && url.startsWith('/') ? (React.createElement(Link, { "data-testid": selectors.components.NavMenu.item, className: styles.element, href: url, target: target, onClick: onClick }, linkContent)) : (React.createElement("a", { "data-testid": selectors.components.NavMenu.item, href: url, target: target, className: styles.element, onClick: onClick }, linkContent));
    }
    return React.createElement("div", { className: styles.wrapper }, element);
}
MegaMenuItemText.displayName = 'MegaMenuItemText';
const getStyles = (theme, isActive) => ({
    button: css({
        backgroundColor: 'unset',
        borderStyle: 'unset',
    }),
    linkContent: css({
        alignItems: 'center',
        display: 'flex',
        gap: '0.5rem',
        height: '100%',
        width: '100%',
    }),
    externalLinkIcon: css({
        color: theme.colors.text.secondary,
    }),
    element: css({
        alignItems: 'center',
        boxSizing: 'border-box',
        position: 'relative',
        color: isActive ? theme.colors.text.primary : theme.colors.text.secondary,
        padding: theme.spacing(1, 1, 1, 0),
        width: '100%',
        '&:hover, &:focus-visible': {
            textDecoration: 'underline',
            color: theme.colors.text.primary,
        },
        '&:focus-visible': {
            boxShadow: 'none',
            outline: `2px solid ${theme.colors.primary.main}`,
            outlineOffset: '-2px',
            transition: 'none',
        },
        '&::before': {
            display: isActive ? 'block' : 'none',
            content: '" "',
            height: theme.spacing(3),
            position: 'absolute',
            left: theme.spacing(1),
            top: '50%',
            transform: 'translateY(-50%)',
            width: theme.spacing(0.5),
            borderRadius: theme.shape.radius.default,
            backgroundImage: theme.colors.gradients.brandVertical,
        },
    }),
    wrapper: css({
        boxSizing: 'border-box',
        position: 'relative',
        display: 'flex',
        width: '100%',
    }),
});
//# sourceMappingURL=MegaMenuItemText.js.map