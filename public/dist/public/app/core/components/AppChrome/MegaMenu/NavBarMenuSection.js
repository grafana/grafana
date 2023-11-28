import { css, cx } from '@emotion/css';
import React from 'react';
import { useLocalStorage } from 'react-use';
import { Button, Icon, useStyles2 } from '@grafana/ui';
import { NavBarItemIcon } from './NavBarItemIcon';
import { NavBarMenuItem } from './NavBarMenuItem';
import { NavFeatureHighlight } from './NavFeatureHighlight';
import { hasChildMatch } from './utils';
export function NavBarMenuSection({ link, activeItem, children, className, onClose, }) {
    var _a;
    const styles = useStyles2(getStyles);
    const FeatureHighlightWrapper = link.highlightText ? NavFeatureHighlight : React.Fragment;
    const isActive = link === activeItem;
    const hasActiveChild = hasChildMatch(link, activeItem);
    const [sectionExpanded, setSectionExpanded] = (_a = useLocalStorage(`grafana.navigation.expanded[${link.text}]`, false)) !== null && _a !== void 0 ? _a : Boolean(hasActiveChild);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: cx(styles.collapsibleSectionWrapper, className) },
            React.createElement(NavBarMenuItem, { isActive: link === activeItem, onClick: () => {
                    var _a;
                    (_a = link.onClick) === null || _a === void 0 ? void 0 : _a.call(link);
                    onClose === null || onClose === void 0 ? void 0 : onClose();
                }, target: link.target, url: link.url },
                React.createElement("div", { className: cx(styles.labelWrapper, {
                        [styles.isActive]: isActive,
                        [styles.hasActiveChild]: hasActiveChild,
                    }) },
                    React.createElement(FeatureHighlightWrapper, null,
                        React.createElement(NavBarItemIcon, { link: link })),
                    link.text)),
            children && (React.createElement(Button, { "aria-label": `${sectionExpanded ? 'Collapse' : 'Expand'} section ${link.text}`, variant: "secondary", fill: "text", className: styles.collapseButton, onClick: () => setSectionExpanded(!sectionExpanded) },
                React.createElement(Icon, { name: sectionExpanded ? 'angle-up' : 'angle-down', size: "xl" })))),
        sectionExpanded && children));
}
const getStyles = (theme) => ({
    collapsibleSectionWrapper: css({
        alignItems: 'center',
        display: 'flex',
    }),
    collapseButton: css({
        color: theme.colors.text.disabled,
        padding: theme.spacing(0, 0.5),
        marginRight: theme.spacing(1),
    }),
    collapseWrapperActive: css({
        backgroundColor: theme.colors.action.disabledBackground,
    }),
    collapseContent: css({
        padding: 0,
    }),
    labelWrapper: css({
        display: 'grid',
        fontSize: theme.typography.pxToRem(14),
        gridAutoFlow: 'column',
        gridTemplateColumns: `${theme.spacing(7)} auto`,
        placeItems: 'center',
        fontWeight: theme.typography.fontWeightMedium,
    }),
    isActive: css({
        color: theme.colors.text.primary,
        '&::before': {
            display: 'block',
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
    hasActiveChild: css({
        color: theme.colors.text.primary,
    }),
});
//# sourceMappingURL=NavBarMenuSection.js.map