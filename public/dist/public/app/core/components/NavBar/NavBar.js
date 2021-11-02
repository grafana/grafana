import { __makeTemplateObject } from "tslib";
import React, { useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { css, cx } from '@emotion/css';
import { Icon, useTheme2 } from '@grafana/ui';
import appEvents from '../../app_events';
import { Branding } from 'app/core/components/Branding/Branding';
import config from 'app/core/config';
import { CoreEvents } from 'app/types';
import TopSection from './TopSection';
import BottomSection from './BottomSection';
var homeUrl = config.appSubUrl || '/';
export var NavBar = React.memo(function () {
    var theme = useTheme2();
    var styles = getStyles(theme);
    var location = useLocation();
    var query = new URLSearchParams(location.search);
    var kiosk = query.get('kiosk');
    var toggleNavBarSmallBreakpoint = useCallback(function () {
        appEvents.emit(CoreEvents.toggleSidemenuMobile);
    }, []);
    if (kiosk !== null) {
        return null;
    }
    return (React.createElement("nav", { className: cx(styles.sidemenu, 'sidemenu'), "data-testid": "sidemenu", "aria-label": "Main menu" },
        React.createElement("a", { href: homeUrl, className: styles.homeLogo },
            React.createElement(Branding.MenuLogo, null)),
        React.createElement("div", { className: styles.mobileSidemenuLogo, onClick: toggleNavBarSmallBreakpoint, key: "hamburger" },
            React.createElement(Icon, { name: "bars", size: "xl" }),
            React.createElement("span", { className: styles.closeButton },
                React.createElement(Icon, { name: "times" }),
                "Close")),
        React.createElement(TopSection, null),
        React.createElement(BottomSection, null)));
});
NavBar.displayName = 'NavBar';
var getStyles = function (theme) { return ({
    sidemenu: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: column;\n    position: fixed;\n    z-index: ", ";\n\n    ", " {\n      background-color: ", ";\n      border-right: 1px solid ", ";\n      position: relative;\n      width: ", "px;\n    }\n\n    .sidemenu-hidden & {\n      display: none;\n    }\n\n    .sidemenu-open--xs & {\n      background-color: ", ";\n      box-shadow: ", ";\n      height: auto;\n      position: absolute;\n      width: 100%;\n    }\n  "], ["\n    display: flex;\n    flex-direction: column;\n    position: fixed;\n    z-index: ", ";\n\n    ", " {\n      background-color: ", ";\n      border-right: 1px solid ", ";\n      position: relative;\n      width: ", "px;\n    }\n\n    .sidemenu-hidden & {\n      display: none;\n    }\n\n    .sidemenu-open--xs & {\n      background-color: ", ";\n      box-shadow: ", ";\n      height: auto;\n      position: absolute;\n      width: 100%;\n    }\n  "])), theme.zIndex.sidemenu, theme.breakpoints.up('md'), theme.colors.background.primary, theme.components.panel.borderColor, theme.components.sidemenu.width, theme.colors.background.primary, theme.shadows.z1),
    homeLogo: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    display: none;\n    min-height: ", "px;\n\n    &:focus-visible,\n    &:hover {\n      background-color: ", ";\n    }\n\n    &:focus-visible {\n      box-shadow: none;\n      color: ", ";\n      outline: 2px solid ", ";\n      outline-offset: -2px;\n      transition: none;\n    }\n\n    img {\n      width: ", ";\n    }\n\n    ", " {\n      align-items: center;\n      display: flex;\n      justify-content: center;\n    }\n  "], ["\n    display: none;\n    min-height: ", "px;\n\n    &:focus-visible,\n    &:hover {\n      background-color: ", ";\n    }\n\n    &:focus-visible {\n      box-shadow: none;\n      color: ", ";\n      outline: 2px solid ", ";\n      outline-offset: -2px;\n      transition: none;\n    }\n\n    img {\n      width: ", ";\n    }\n\n    ", " {\n      align-items: center;\n      display: flex;\n      justify-content: center;\n    }\n  "])), theme.components.sidemenu.width, theme.colors.action.hover, theme.colors.text.primary, theme.colors.primary.main, theme.spacing(3.5), theme.breakpoints.up('md')),
    closeButton: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    display: none;\n\n    .sidemenu-open--xs & {\n      display: block;\n      font-size: ", "px;\n    }\n  "], ["\n    display: none;\n\n    .sidemenu-open--xs & {\n      display: block;\n      font-size: ", "px;\n    }\n  "])), theme.typography.fontSize),
    mobileSidemenuLogo: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    align-items: center;\n    cursor: pointer;\n    display: flex;\n    flex-direction: row;\n    justify-content: space-between;\n    padding: ", ";\n\n    ", " {\n      display: none;\n    }\n  "], ["\n    align-items: center;\n    cursor: pointer;\n    display: flex;\n    flex-direction: row;\n    justify-content: space-between;\n    padding: ", ";\n\n    ", " {\n      display: none;\n    }\n  "])), theme.spacing(2), theme.breakpoints.up('md')),
}); };
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=NavBar.js.map