import { css, cx } from '@emotion/css';
import React from 'react';
import { useLocalStorage } from 'react-use';
import { toIconName } from '@grafana/data';
import { Button, Icon, useStyles2, Text } from '@grafana/ui';
import { Indent } from '../../Indent/Indent';
import { FeatureHighlight } from './FeatureHighlight';
import { MegaMenuItemText } from './MegaMenuItemText';
import { hasChildMatch } from './utils';
// max level depth to render
const MAX_DEPTH = 2;
export function MegaMenuItem({ link, activeItem, level = 0, onClick }) {
    var _a, _b;
    const styles = useStyles2(getStyles);
    const FeatureHighlightWrapper = link.highlightText ? FeatureHighlight : React.Fragment;
    const isActive = link === activeItem;
    const hasActiveChild = hasChildMatch(link, activeItem);
    const [sectionExpanded, setSectionExpanded] = (_a = useLocalStorage(`grafana.navigation.expanded[${link.text}]`, false)) !== null && _a !== void 0 ? _a : Boolean(hasActiveChild);
    const showExpandButton = level < MAX_DEPTH && (linkHasChildren(link) || link.emptyMessage);
    return (React.createElement("li", { className: styles.listItem },
        React.createElement("div", { className: styles.collapsibleSectionWrapper },
            React.createElement(MegaMenuItemText, { isActive: isActive, onClick: () => {
                    var _a;
                    (_a = link.onClick) === null || _a === void 0 ? void 0 : _a.call(link);
                    onClick === null || onClick === void 0 ? void 0 : onClick();
                }, target: link.target, url: link.url },
                React.createElement("div", { className: cx(styles.labelWrapper, {
                        [styles.isActive]: isActive,
                    }) },
                    React.createElement(FeatureHighlightWrapper, null,
                        React.createElement("div", { className: styles.iconWrapper }, level === 0 && link.icon && React.createElement(Icon, { name: (_b = toIconName(link.icon)) !== null && _b !== void 0 ? _b : 'link', size: "xl" }))),
                    React.createElement(Indent, { level: Math.max(0, level - 1), spacing: 2 }),
                    React.createElement(Text, { truncate: true }, link.text))),
            showExpandButton && (React.createElement(Button, { "aria-label": `${sectionExpanded ? 'Collapse' : 'Expand'} section ${link.text}`, variant: "secondary", fill: "text", className: styles.collapseButton, onClick: () => setSectionExpanded(!sectionExpanded) },
                React.createElement(Icon, { name: sectionExpanded ? 'angle-up' : 'angle-down', size: "xl" })))),
        showExpandButton && sectionExpanded && (React.createElement("ul", { className: styles.children }, linkHasChildren(link) ? (link.children
            .filter((childLink) => !childLink.isCreateAction)
            .map((childLink) => (React.createElement(MegaMenuItem, { key: `${link.text}-${childLink.text}`, link: childLink, activeItem: activeItem, onClick: onClick, level: level + 1 })))) : (React.createElement("div", { className: styles.emptyMessage }, link.emptyMessage))))));
}
const getStyles = (theme) => ({
    children: css({
        display: 'flex',
        listStyleType: 'none',
        flexDirection: 'column',
    }),
    collapsibleSectionWrapper: css({
        alignItems: 'center',
        display: 'flex',
    }),
    collapseButton: css({
        color: theme.colors.text.disabled,
        padding: theme.spacing(0, 0.5),
        marginRight: theme.spacing(1),
    }),
    emptyMessage: css({
        color: theme.colors.text.secondary,
        fontStyle: 'italic',
        padding: theme.spacing(1, 1.5, 1, 7),
    }),
    iconWrapper: css({
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
    }),
    labelWrapper: css({
        display: 'grid',
        fontSize: theme.typography.pxToRem(14),
        gridAutoFlow: 'column',
        gridTemplateColumns: `${theme.spacing(7)} auto`,
        alignItems: 'center',
        fontWeight: theme.typography.fontWeightMedium,
    }),
    listItem: css({
        flex: 1,
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
});
function linkHasChildren(link) {
    return Boolean(link.children && link.children.length > 0);
}
//# sourceMappingURL=MegaMenuItem.js.map