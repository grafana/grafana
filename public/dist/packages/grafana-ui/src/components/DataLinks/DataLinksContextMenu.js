import { __makeTemplateObject } from "tslib";
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { css } from '@emotion/css';
import { WithContextMenu } from '../ContextMenu/WithContextMenu';
import { linkModelToContextMenuItems } from '../../utils/dataLinks';
import { MenuGroup } from '../Menu/MenuGroup';
import { MenuItem } from '../Menu/MenuItem';
export var DataLinksContextMenu = function (_a) {
    var children = _a.children, links = _a.links, config = _a.config;
    var linksCounter = config.links.length;
    var itemsGroup = [{ items: linkModelToContextMenuItems(links), label: 'Data links' }];
    var renderMenuGroupItems = function () {
        return itemsGroup.map(function (group, index) { return (React.createElement(MenuGroup, { key: "" + group.label + index, label: group.label }, (group.items || []).map(function (item) { return (React.createElement(MenuItem, { key: item.label, url: item.url, label: item.label, target: item.target, icon: item.icon, active: item.active, onClick: item.onClick })); }))); });
    };
    // Use this class name (exposed via render prop) to add context menu indicator to the click target of the visualization
    var targetClassName = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    cursor: context-menu;\n  "], ["\n    cursor: context-menu;\n  "])));
    if (linksCounter > 1) {
        return (React.createElement(WithContextMenu, { renderMenuItems: renderMenuGroupItems }, function (_a) {
            var openMenu = _a.openMenu;
            return children({ openMenu: openMenu, targetClassName: targetClassName });
        }));
    }
    else {
        var linkModel = links()[0];
        return (React.createElement("a", { href: linkModel.href, onClick: linkModel.onClick, target: linkModel.target, title: linkModel.title, style: { display: 'flex' }, "aria-label": selectors.components.DataLinksContextMenu.singleLink }, children({})));
    }
};
var templateObject_1;
//# sourceMappingURL=DataLinksContextMenu.js.map