import { __makeTemplateObject } from "tslib";
import React from 'react';
import { useLocation } from 'react-router-dom';
import { cloneDeep } from 'lodash';
import { css } from '@emotion/css';
import { locationService } from '@grafana/runtime';
import { Icon, useTheme2 } from '@grafana/ui';
import config from '../../config';
import { isLinkActive, isSearchActive } from './utils';
import NavBarItem from './NavBarItem';
var TopSection = function () {
    var _a;
    var location = useLocation();
    var theme = useTheme2();
    var styles = getStyles(theme);
    var navTree = cloneDeep(config.bootData.navTree);
    var mainLinks = navTree.filter(function (item) { return !item.hideFromMenu; });
    var activeItemId = (_a = mainLinks.find(function (item) { return isLinkActive(location.pathname, item); })) === null || _a === void 0 ? void 0 : _a.id;
    var onOpenSearch = function () {
        locationService.partial({ search: 'open' });
    };
    return (React.createElement("div", { "data-testid": "top-section-items", className: styles.container },
        React.createElement(NavBarItem, { isActive: isSearchActive(location), label: "Search dashboards", onClick: onOpenSearch },
            React.createElement(Icon, { name: "search", size: "xl" })),
        mainLinks.map(function (link, index) {
            return (React.createElement(NavBarItem, { key: link.id + "-" + index, isActive: !isSearchActive(location) && activeItemId === link.id, label: link.text, menuItems: link.children, target: link.target, url: link.url },
                link.icon && React.createElement(Icon, { name: link.icon, size: "xl" }),
                link.img && React.createElement("img", { src: link.img, alt: link.text + " logo" })));
        })));
};
export default TopSection;
var getStyles = function (theme) { return ({
    container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    display: none;\n    flex-grow: 1;\n\n    ", " {\n      display: flex;\n      flex-direction: inherit;\n      margin-top: ", ";\n    }\n\n    .sidemenu-open--xs & {\n      display: block;\n    }\n  "], ["\n    display: none;\n    flex-grow: 1;\n\n    ", " {\n      display: flex;\n      flex-direction: inherit;\n      margin-top: ", ";\n    }\n\n    .sidemenu-open--xs & {\n      display: block;\n    }\n  "])), theme.breakpoints.up('md'), theme.spacing(5)),
}); };
var templateObject_1;
//# sourceMappingURL=TopSection.js.map