import { __makeTemplateObject, __values } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { Tab, TabsBar, Icon, useStyles2 } from '@grafana/ui';
import { PanelHeaderMenuItem } from 'app/features/dashboard/dashgrid/PanelHeader/PanelHeaderMenuItem';
var SelectNav = function (_a) {
    var children = _a.children, customCss = _a.customCss;
    if (!children || children.length === 0) {
        return null;
    }
    var defaultSelectedItem = children.find(function (navItem) {
        return navItem.active === true;
    });
    return (React.createElement("div", { className: "gf-form-select-wrapper width-20 " + customCss },
        React.createElement("div", { className: "dropdown" },
            React.createElement("div", { className: "gf-form-input dropdown-toggle", "data-toggle": "dropdown" }, defaultSelectedItem === null || defaultSelectedItem === void 0 ? void 0 : defaultSelectedItem.text),
            React.createElement("ul", { className: "dropdown-menu dropdown-menu--menu" }, children.map(function (navItem) {
                if (navItem.hideFromTabs) {
                    // TODO: Rename hideFromTabs => hideFromNav
                    return null;
                }
                return (React.createElement(PanelHeaderMenuItem, { key: navItem.url, iconClassName: navItem.icon, text: navItem.text, href: navItem.url }));
            })))));
};
var Navigation = function (_a) {
    var children = _a.children;
    if (!children || children.length === 0) {
        return null;
    }
    return (React.createElement("nav", null,
        React.createElement(SelectNav, { customCss: "page-header__select-nav" }, children),
        React.createElement(TabsBar, { className: "page-header__tabs", hideBorder: true }, children.map(function (child, index) {
            return (!child.hideFromTabs && (React.createElement(Tab, { label: child.text, active: child.active, key: child.url + "-" + index, icon: child.icon, href: child.url })));
        }))));
};
export var PageHeader = function (_a) {
    var model = _a.model;
    var styles = useStyles2(getStyles);
    if (!model) {
        return null;
    }
    var main = model.main;
    var children = main.children;
    return (React.createElement("div", { className: styles.headerCanvas },
        React.createElement("div", { className: "page-container" },
            React.createElement("div", { className: "page-header" },
                renderHeaderTitle(main),
                children && children.length && React.createElement(Navigation, null, children)))));
};
function renderHeaderTitle(main) {
    var _a;
    var marginTop = main.icon === 'grafana' ? 12 : 14;
    return (React.createElement("div", { className: "page-header__inner" },
        React.createElement("span", { className: "page-header__logo" },
            main.icon && React.createElement(Icon, { name: main.icon, size: "xxxl", style: { marginTop: marginTop } }),
            main.img && React.createElement("img", { className: "page-header__img", src: main.img, alt: "logo of " + main.text })),
        React.createElement("div", { className: "page-header__info-block" },
            renderTitle(main.text, (_a = main.breadcrumbs) !== null && _a !== void 0 ? _a : []),
            main.subTitle && React.createElement("div", { className: "page-header__sub-title" }, main.subTitle))));
}
function renderTitle(title, breadcrumbs) {
    var e_1, _a;
    if (!title && (!breadcrumbs || breadcrumbs.length === 0)) {
        return null;
    }
    if (!breadcrumbs || breadcrumbs.length === 0) {
        return React.createElement("h1", { className: "page-header__title" }, title);
    }
    var breadcrumbsResult = [];
    try {
        for (var breadcrumbs_1 = __values(breadcrumbs), breadcrumbs_1_1 = breadcrumbs_1.next(); !breadcrumbs_1_1.done; breadcrumbs_1_1 = breadcrumbs_1.next()) {
            var bc = breadcrumbs_1_1.value;
            if (bc.url) {
                breadcrumbsResult.push(React.createElement("a", { className: "page-header__link", key: breadcrumbsResult.length, href: bc.url }, bc.title));
            }
            else {
                breadcrumbsResult.push(React.createElement("span", { key: breadcrumbsResult.length },
                    " / ",
                    bc.title));
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (breadcrumbs_1_1 && !breadcrumbs_1_1.done && (_a = breadcrumbs_1.return)) _a.call(breadcrumbs_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    breadcrumbsResult.push(React.createElement("span", { key: breadcrumbs.length + 1 },
        " / ",
        title));
    return React.createElement("h1", { className: "page-header__title" }, breadcrumbsResult);
}
var getStyles = function (theme) { return ({
    headerCanvas: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    background: ", ";\n  "], ["\n    background: ", ";\n  "])), theme.colors.background.canvas),
}); };
export default PageHeader;
var templateObject_1;
//# sourceMappingURL=PageHeader.js.map