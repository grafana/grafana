import { css, cx } from '@emotion/css';
import React from 'react';
import { Tab, TabsBar, Icon, useStyles2, toIconName } from '@grafana/ui';
import { PanelHeaderMenuItem } from 'app/core/components/PageHeader/PanelHeaderMenuItem';
import { PageInfo } from '../PageInfo/PageInfo';
import { ProBadge } from '../Upgrade/ProBadge';
const SelectNav = ({ children, customCss }) => {
    if (!children || children.length === 0) {
        return null;
    }
    const defaultSelectedItem = children.find((navItem) => {
        return navItem.active === true;
    });
    return (React.createElement("div", { className: `gf-form-select-wrapper width-20 ${customCss}` },
        React.createElement("div", { className: "dropdown" },
            React.createElement("button", { type: "button", className: "gf-form-input dropdown-toggle", "data-toggle": "dropdown", style: { textAlign: 'left' } }, defaultSelectedItem === null || defaultSelectedItem === void 0 ? void 0 : defaultSelectedItem.text),
            React.createElement("ul", { role: "menu", className: "dropdown-menu dropdown-menu--menu" }, children.map((navItem) => {
                if (navItem.hideFromTabs) {
                    // TODO: Rename hideFromTabs => hideFromNav
                    return null;
                }
                return (React.createElement(PanelHeaderMenuItem, { key: navItem.url, iconClassName: navItem.icon, text: navItem.text, href: navItem.url }));
            })))));
};
const Navigation = ({ children }) => {
    if (!children || children.length === 0) {
        return null;
    }
    return (React.createElement("nav", null,
        React.createElement(SelectNav, { customCss: "page-header__select-nav" }, children),
        React.createElement(TabsBar, { className: "page-header__tabs", hideBorder: true }, children.map((child, index) => {
            return (!child.hideFromTabs && (React.createElement(Tab, { label: child.text, active: child.active, key: `${child.url}-${index}`, icon: child.icon, href: child.url, suffix: child.tabSuffix })));
        }))));
};
export const PageHeader = ({ navItem: model, renderTitle, actions, info, subTitle }) => {
    const styles = useStyles2(getStyles);
    if (!model) {
        return null;
    }
    const renderHeader = (main) => {
        const marginTop = main.icon === 'grafana' ? 12 : 14;
        const icon = main.icon && toIconName(main.icon);
        const sub = subTitle !== null && subTitle !== void 0 ? subTitle : main.subTitle;
        return (React.createElement("div", { className: "page-header__inner" },
            React.createElement("span", { className: "page-header__logo" },
                icon && React.createElement(Icon, { name: icon, size: "xxxl", style: { marginTop } }),
                main.img && React.createElement("img", { className: "page-header__img", src: main.img, alt: "" })),
            React.createElement("div", { className: cx('page-header__info-block', styles.headerText) },
                renderTitle ? renderTitle(main.text) : renderHeaderTitle(main.text, main.highlightText),
                info && React.createElement(PageInfo, { info: info }),
                sub && React.createElement("div", { className: "page-header__sub-title" }, sub),
                actions && React.createElement("div", { className: styles.actions }, actions))));
    };
    return (React.createElement("div", { className: styles.headerCanvas },
        React.createElement("div", { className: "page-container" },
            React.createElement("div", { className: "page-header" },
                renderHeader(model),
                model.children && model.children.length > 0 && React.createElement(Navigation, null, model.children)))));
};
function renderHeaderTitle(title, highlightText) {
    if (!title) {
        return null;
    }
    return (React.createElement("h1", { className: "page-header__title" },
        title,
        highlightText && (React.createElement(ProBadge, { text: highlightText, className: css `
            vertical-align: middle;
          ` }))));
}
const getStyles = (theme) => ({
    actions: css({
        display: 'flex',
        flexDirection: 'row',
        gap: theme.spacing(1),
    }),
    headerText: css({
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(1),
    }),
    headerCanvas: css `
    background: ${theme.colors.background.canvas};
  `,
});
//# sourceMappingURL=PageHeader.js.map