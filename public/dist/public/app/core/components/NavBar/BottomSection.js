import { __makeTemplateObject, __read, __spreadArray } from "tslib";
import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { cloneDeep } from 'lodash';
import { css } from '@emotion/css';
import { Icon, useTheme2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import appEvents from '../../app_events';
import { ShowModalReactEvent } from '../../../types/events';
import config from '../../config';
import { OrgSwitcher } from '../OrgSwitcher';
import { getFooterLinks } from '../Footer/Footer';
import { HelpModal } from '../help/HelpModal';
import NavBarItem from './NavBarItem';
import { getForcedLoginUrl, isLinkActive, isSearchActive } from './utils';
export default function BottomSection() {
    var _a;
    var theme = useTheme2();
    var styles = getStyles(theme);
    var navTree = cloneDeep(config.bootData.navTree);
    var bottomNav = navTree.filter(function (item) { return item.hideFromMenu; });
    var isSignedIn = contextSrv.isSignedIn;
    var location = useLocation();
    var activeItemId = (_a = bottomNav.find(function (item) { return isLinkActive(location.pathname, item); })) === null || _a === void 0 ? void 0 : _a.id;
    var forcedLoginUrl = getForcedLoginUrl(location.pathname + location.search);
    var user = contextSrv.user;
    var _b = __read(useState(false), 2), showSwitcherModal = _b[0], setShowSwitcherModal = _b[1];
    var toggleSwitcherModal = function () {
        setShowSwitcherModal(!showSwitcherModal);
    };
    var onOpenShortcuts = function () {
        appEvents.publish(new ShowModalReactEvent({ component: HelpModal }));
    };
    if (user && user.orgCount > 1) {
        var profileNode = bottomNav.find(function (bottomNavItem) { return bottomNavItem.id === 'profile'; });
        if (profileNode) {
            profileNode.showOrgSwitcher = true;
            profileNode.subTitle = "Current Org.: " + (user === null || user === void 0 ? void 0 : user.orgName);
        }
    }
    return (React.createElement("div", { "data-testid": "bottom-section-items", className: styles.container },
        !isSignedIn && (React.createElement(NavBarItem, { label: "Sign In", target: "_self", url: forcedLoginUrl },
            React.createElement(Icon, { name: "signout", size: "xl" }))),
        bottomNav.map(function (link, index) {
            var menuItems = link.children || [];
            if (link.id === 'help') {
                menuItems = __spreadArray(__spreadArray([], __read(getFooterLinks()), false), [
                    {
                        text: 'Keyboard shortcuts',
                        icon: 'keyboard',
                        onClick: onOpenShortcuts,
                    },
                ], false);
            }
            if (link.showOrgSwitcher) {
                menuItems = __spreadArray(__spreadArray([], __read(menuItems), false), [
                    {
                        text: 'Switch organization',
                        icon: 'arrow-random',
                        onClick: toggleSwitcherModal,
                    },
                ], false);
            }
            return (React.createElement(NavBarItem, { key: link.url + "-" + index, isActive: !isSearchActive(location) && activeItemId === link.id, label: link.text, menuItems: menuItems, menuSubTitle: link.subTitle, onClick: link.onClick, reverseMenuDirection: true, target: link.target, url: link.url },
                link.icon && React.createElement(Icon, { name: link.icon, size: "xl" }),
                link.img && React.createElement("img", { src: link.img, alt: link.text + " logo" })));
        }),
        showSwitcherModal && React.createElement(OrgSwitcher, { onDismiss: toggleSwitcherModal })));
}
var getStyles = function (theme) { return ({
    container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    display: none;\n\n    ", " {\n      display: flex;\n      flex-direction: inherit;\n      margin-bottom: ", ";\n    }\n\n    .sidemenu-open--xs & {\n      display: block;\n    }\n  "], ["\n    display: none;\n\n    ", " {\n      display: flex;\n      flex-direction: inherit;\n      margin-bottom: ", ";\n    }\n\n    .sidemenu-open--xs & {\n      display: block;\n    }\n  "])), theme.breakpoints.up('md'), theme.spacing(2)),
}); };
var templateObject_1;
//# sourceMappingURL=BottomSection.js.map