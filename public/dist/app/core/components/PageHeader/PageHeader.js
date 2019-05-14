import * as tslib_1 from "tslib";
import React from 'react';
import classNames from 'classnames';
import appEvents from 'app/core/app_events';
var SelectNav = function (_a) {
    var main = _a.main, customCss = _a.customCss;
    var defaultSelectedItem = main.children.find(function (navItem) {
        return navItem.active === true;
    });
    var gotoUrl = function (evt) {
        var element = evt.target;
        var url = element.options[element.selectedIndex].value;
        appEvents.emit('location-change', { href: url });
    };
    return (React.createElement("div", { className: "gf-form-select-wrapper width-20 " + customCss },
        React.createElement("label", { className: "gf-form-select-icon " + defaultSelectedItem.icon, htmlFor: "page-header-select-nav" }),
        React.createElement("select", { className: "gf-select-nav gf-form-input", value: defaultSelectedItem.url, onChange: gotoUrl, id: "page-header-select-nav" }, main.children.map(function (navItem) {
            if (navItem.hideFromTabs) {
                // TODO: Rename hideFromTabs => hideFromNav
                return null;
            }
            return (React.createElement("option", { key: navItem.url, value: navItem.url }, navItem.text));
        }))));
};
var Tabs = function (_a) {
    var main = _a.main, customCss = _a.customCss;
    return (React.createElement("ul", { className: "gf-tabs " + customCss }, main.children.map(function (tab, idx) {
        if (tab.hideFromTabs) {
            return null;
        }
        var tabClasses = classNames({
            'gf-tabs-link': true,
            active: tab.active,
        });
        return (React.createElement("li", { className: "gf-tabs-item", key: tab.url },
            React.createElement("a", { className: tabClasses, target: tab.target, href: tab.url },
                React.createElement("i", { className: tab.icon }),
                tab.text)));
    })));
};
var Navigation = function (_a) {
    var main = _a.main;
    return (React.createElement("nav", null,
        React.createElement(SelectNav, { customCss: "page-header__select-nav", main: main }),
        React.createElement(Tabs, { customCss: "page-header__tabs", main: main })));
};
var PageHeader = /** @class */ (function (_super) {
    tslib_1.__extends(PageHeader, _super);
    function PageHeader(props) {
        return _super.call(this, props) || this;
    }
    PageHeader.prototype.shouldComponentUpdate = function () {
        //Hack to re-render on changed props from angular with the @observer decorator
        return true;
    };
    PageHeader.prototype.renderTitle = function (title, breadcrumbs) {
        if (!title && (!breadcrumbs || breadcrumbs.length === 0)) {
            return null;
        }
        if (!breadcrumbs || breadcrumbs.length === 0) {
            return React.createElement("h1", { className: "page-header__title" }, title);
        }
        var breadcrumbsResult = [];
        for (var i = 0; i < breadcrumbs.length; i++) {
            var bc = breadcrumbs[i];
            if (bc.url) {
                breadcrumbsResult.push(React.createElement("a", { className: "text-link", key: i, href: bc.url }, bc.title));
            }
            else {
                breadcrumbsResult.push(React.createElement("span", { key: i },
                    " / ",
                    bc.title));
            }
        }
        breadcrumbsResult.push(React.createElement("span", { key: breadcrumbs.length + 1 },
            " / ",
            title));
        return React.createElement("h1", { className: "page-header__title" }, breadcrumbsResult);
    };
    PageHeader.prototype.renderHeaderTitle = function (main) {
        return (React.createElement("div", { className: "page-header__inner" },
            React.createElement("span", { className: "page-header__logo" },
                main.icon && React.createElement("i", { className: "page-header__icon " + main.icon }),
                main.img && React.createElement("img", { className: "page-header__img", src: main.img })),
            React.createElement("div", { className: "page-header__info-block" },
                this.renderTitle(main.text, main.breadcrumbs),
                main.subTitle && React.createElement("div", { className: "page-header__sub-title" }, main.subTitle),
                main.subType && (React.createElement("div", { className: "page-header__stamps" },
                    React.createElement("i", { className: main.subType.icon }),
                    main.subType.text)))));
    };
    PageHeader.prototype.render = function () {
        var model = this.props.model;
        if (!model) {
            return null;
        }
        var main = model.main;
        return (React.createElement("div", { className: "page-header-canvas" },
            React.createElement("div", { className: "page-container" },
                React.createElement("div", { className: "page-header" },
                    this.renderHeaderTitle(main),
                    main.children && React.createElement(Navigation, { main: main })))));
    };
    return PageHeader;
}(React.Component));
export default PageHeader;
//# sourceMappingURL=PageHeader.js.map