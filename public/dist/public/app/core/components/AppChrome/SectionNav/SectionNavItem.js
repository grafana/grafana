import { css, cx } from '@emotion/css';
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import { useStyles2, Icon } from '@grafana/ui';
// max level depth to render
const MAX_DEPTH = 2;
export function SectionNavItem({ item, isSectionRoot = false, level = 0 }) {
    var _a, _b;
    const styles = useStyles2(getStyles);
    const children = (_a = item.children) === null || _a === void 0 ? void 0 : _a.filter((x) => !x.hideFromTabs);
    // If first root child is a section skip the bottom margin (as sections have top margin already)
    const noRootMargin = isSectionRoot && Boolean((_b = item.children[0].children) === null || _b === void 0 ? void 0 : _b.length);
    const linkClass = cx({
        [styles.link]: true,
        [styles.activeStyle]: item.active,
        [styles.isSection]: level < MAX_DEPTH && (Boolean(children === null || children === void 0 ? void 0 : children.length) || item.isSection),
        [styles.isSectionRoot]: isSectionRoot,
        [styles.noRootMargin]: noRootMargin,
    });
    let icon = null;
    if (item.img) {
        icon = React.createElement("img", { "data-testid": "section-image", className: styles.sectionImg, src: item.img, alt: "" });
    }
    else if (item.icon) {
        icon = React.createElement(Icon, { "data-testid": "section-icon", className: styles.sectionImg, name: item.icon });
    }
    const onItemClicked = () => {
        var _a;
        reportInteraction('grafana_navigation_item_clicked', {
            path: (_a = item.url) !== null && _a !== void 0 ? _a : item.id,
            sectionNav: true,
        });
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("a", { onClick: onItemClicked, href: item.url, className: linkClass, "aria-label": selectors.components.Tab.title(item.text), role: "tab", "aria-selected": item.active },
            isSectionRoot && icon,
            item.text,
            item.tabSuffix && React.createElement(item.tabSuffix, { className: styles.suffix })),
        level < MAX_DEPTH &&
            (children === null || children === void 0 ? void 0 : children.map((child, index) => React.createElement(SectionNavItem, { item: child, key: index, level: level + 1 })))));
}
const getStyles = (theme) => {
    return {
        link: css `
      padding: ${theme.spacing(1, 0, 1, 1.5)};
      display: flex;
      align-items: flex-start;
      border-radius: ${theme.shape.radius.default};
      gap: ${theme.spacing(1)};
      height: 100%;
      position: relative;
      color: ${theme.colors.text.secondary};

      &:hover,
      &:focus {
        text-decoration: underline;
        z-index: 1;
      }
    `,
        activeStyle: css `
      label: activeTabStyle;
      color: ${theme.colors.text.primary};
      font-weight: ${theme.typography.fontWeightMedium};
      background: ${theme.colors.emphasize(theme.colors.background.canvas, 0.03)};

      &::before {
        display: block;
        content: ' ';
        position: absolute;
        left: 0;
        width: 4px;
        bottom: 2px;
        top: 2px;
        border-radius: ${theme.shape.radius.default};
        background-image: ${theme.colors.gradients.brandVertical};
      }
    `,
        suffix: css `
      margin-left: ${theme.spacing(1)};
    `,
        sectionImg: css({
            margin: '6px 0',
            width: theme.spacing(2),
        }),
        isSectionRoot: css({
            fontSize: theme.typography.h4.fontSize,
            marginTop: 0,
            marginBottom: theme.spacing(2),
            fontWeight: theme.typography.fontWeightMedium,
        }),
        isSection: css({
            color: theme.colors.text.primary,
            fontSize: theme.typography.h5.fontSize,
            marginTop: theme.spacing(2),
            fontWeight: theme.typography.fontWeightMedium,
        }),
        noRootMargin: css({
            marginBottom: 0,
        }),
    };
};
//# sourceMappingURL=SectionNavItem.js.map