import { css, cx } from '@emotion/css';
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Icon, Link, useTheme2 } from '@grafana/ui';
export function NavBarMenuItem({ children, icon, isActive, isChild, onClick, target, url }) {
    const theme = useTheme2();
    const styles = getStyles(theme, isActive, isChild);
    const linkContent = (React.createElement("div", { className: styles.linkContent },
        icon && React.createElement(Icon, { "data-testid": "dropdown-child-icon", name: icon }),
        React.createElement("div", { className: styles.linkText }, children),
        target === '_blank' && (React.createElement(Icon, { "data-testid": "external-link-icon", name: "external-link-alt", className: styles.externalLinkIcon }))));
    let element = (React.createElement("button", { "data-testid": selectors.components.NavMenu.item, className: cx(styles.button, styles.element), onClick: onClick }, linkContent));
    if (url) {
        element =
            !target && url.startsWith('/') ? (React.createElement(Link, { "data-testid": selectors.components.NavMenu.item, className: styles.element, href: url, target: target, onClick: onClick }, linkContent)) : (React.createElement("a", { "data-testid": selectors.components.NavMenu.item, href: url, target: target, className: styles.element, onClick: onClick }, linkContent));
    }
    return React.createElement("li", { className: styles.listItem }, element);
}
NavBarMenuItem.displayName = 'NavBarMenuItem';
const getStyles = (theme, isActive, isChild) => ({
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
    linkText: css({
        textOverflow: 'ellipsis',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
    }),
    externalLinkIcon: css({
        color: theme.colors.text.secondary,
    }),
    element: css(Object.assign(Object.assign({ alignItems: 'center', boxSizing: 'border-box', position: 'relative', color: isActive ? theme.colors.text.primary : theme.colors.text.secondary, padding: theme.spacing(1, 1, 1, isChild ? 5 : 0) }, (isChild && {
        borderRadius: theme.shape.radius.default,
    })), { width: '100%', '&:hover, &:focus-visible': Object.assign(Object.assign({}, (isChild && {
            background: theme.colors.emphasize(theme.colors.background.primary, 0.03),
        })), { textDecoration: 'underline', color: theme.colors.text.primary }), '&:focus-visible': {
            boxShadow: 'none',
            outline: `2px solid ${theme.colors.primary.main}`,
            outlineOffset: '-2px',
            transition: 'none',
        }, '&::before': {
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
        } })),
    listItem: css(Object.assign({ boxSizing: 'border-box', position: 'relative', display: 'flex', width: '100%' }, (isChild && {
        padding: theme.spacing(0, 2),
    }))),
});
//# sourceMappingURL=NavBarMenuItem.js.map