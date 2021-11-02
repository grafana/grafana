import { __assign, __makeTemplateObject, __read, __spreadArray } from "tslib";
import React, { useCallback, useState } from 'react';
import { getEdgeFields, getNodeFields } from './utils';
import { css } from '@emotion/css';
import { ContextMenu, MenuGroup, MenuItem, stylesFactory, useTheme } from '@grafana/ui';
/**
 * Hook that contains state of the context menu, both for edges and nodes and provides appropriate component when
 * opened context menu should be opened.
 */
export function useContextMenu(getLinks, nodes, edges, config, setConfig, setFocusedNodeId) {
    var _a = __read(useState(undefined), 2), menu = _a[0], setMenu = _a[1];
    var onNodeOpen = useCallback(function (event, node) {
        var extraNodeItem = config.gridLayout
            ? [
                {
                    label: 'Show in Graph layout',
                    onClick: function (node) {
                        setFocusedNodeId(node.id);
                        setConfig(__assign(__assign({}, config), { gridLayout: false }));
                    },
                },
            ]
            : undefined;
        var renderer = getItemsRenderer(getLinks(nodes, node.dataFrameRowIndex), node, extraNodeItem);
        if (renderer) {
            setMenu(React.createElement(ContextMenu, { renderHeader: function () { return React.createElement(NodeHeader, { node: node, nodes: nodes }); }, renderMenuItems: renderer, onClose: function () { return setMenu(undefined); }, x: event.pageX, y: event.pageY }));
        }
    }, [config, nodes, getLinks, setMenu, setConfig, setFocusedNodeId]);
    var onEdgeOpen = useCallback(function (event, edge) {
        var renderer = getItemsRenderer(getLinks(edges, edge.dataFrameRowIndex), edge);
        if (renderer) {
            setMenu(React.createElement(ContextMenu, { renderHeader: function () { return React.createElement(EdgeHeader, { edge: edge, edges: edges }); }, renderMenuItems: renderer, onClose: function () { return setMenu(undefined); }, x: event.pageX, y: event.pageY }));
        }
    }, [edges, getLinks, setMenu]);
    return { onEdgeOpen: onEdgeOpen, onNodeOpen: onNodeOpen, MenuComponent: menu };
}
function getItemsRenderer(links, item, extraItems) {
    if (!(links.length || (extraItems === null || extraItems === void 0 ? void 0 : extraItems.length))) {
        return undefined;
    }
    var items = getItems(links);
    return function () {
        var groups = items === null || items === void 0 ? void 0 : items.map(function (group, index) { return (React.createElement(MenuGroup, { key: "" + group.label + index, label: group.label }, (group.items || []).map(mapMenuItem(item)))); });
        if (extraItems) {
            groups = __spreadArray(__spreadArray([], __read(extraItems.map(mapMenuItem(item))), false), __read(groups), false);
        }
        return groups;
    };
}
function mapMenuItem(item) {
    return function NodeGraphMenuItem(link) {
        return (React.createElement(MenuItem, { key: link.label, url: link.url, label: link.label, ariaLabel: link.ariaLabel, onClick: link.onClick ? function () { var _a; return (_a = link.onClick) === null || _a === void 0 ? void 0 : _a.call(link, item); } : undefined, target: '_self' }));
    };
}
function getItems(links) {
    var defaultGroup = 'Open in Explore';
    var groups = links.reduce(function (acc, l) {
        var group;
        var title;
        if (l.title.indexOf('/') !== -1) {
            group = l.title.split('/')[0];
            title = l.title.split('/')[1];
            acc[group] = acc[group] || [];
            acc[group].push({ l: l, newTitle: title });
        }
        else {
            acc[defaultGroup] = acc[defaultGroup] || [];
            acc[defaultGroup].push({ l: l });
        }
        return acc;
    }, {});
    return Object.keys(groups).map(function (key) {
        return {
            label: key,
            ariaLabel: key,
            items: groups[key].map(function (link) { return ({
                label: link.newTitle || link.l.title,
                ariaLabel: link.newTitle || link.l.title,
                url: link.l.href,
                onClick: link.l.onClick,
            }); }),
        };
    });
}
function NodeHeader(props) {
    var index = props.node.dataFrameRowIndex;
    var fields = getNodeFields(props.nodes);
    return (React.createElement("div", null,
        fields.title && React.createElement(Label, { field: fields.title, index: index }),
        fields.subTitle && React.createElement(Label, { field: fields.subTitle, index: index }),
        fields.details.map(function (f) { return (React.createElement(Label, { key: f.name, field: f, index: index })); })));
}
function EdgeHeader(props) {
    var index = props.edge.dataFrameRowIndex;
    var fields = getEdgeFields(props.edges);
    return (React.createElement("div", null, fields.details.map(function (f) { return (React.createElement(Label, { key: f.name, field: f, index: index })); })));
}
export var getLabelStyles = stylesFactory(function (theme) {
    return {
        label: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: Label;\n      line-height: 1.25;\n      margin: ", ";\n      padding: ", ";\n      color: ", ";\n      font-size: ", ";\n      font-weight: ", ";\n    "], ["\n      label: Label;\n      line-height: 1.25;\n      margin: ", ";\n      padding: ", ";\n      color: ", ";\n      font-size: ", ";\n      font-weight: ", ";\n    "])), theme.spacing.formLabelMargin, theme.spacing.formLabelPadding, theme.colors.textFaint, theme.typography.size.sm, theme.typography.weight.semibold),
        value: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      label: Value;\n      font-size: ", ";\n      font-weight: ", ";\n      color: ", ";\n      margin-top: ", ";\n      display: block;\n    "], ["\n      label: Value;\n      font-size: ", ";\n      font-weight: ", ";\n      color: ", ";\n      margin-top: ", ";\n      display: block;\n    "])), theme.typography.size.sm, theme.typography.weight.semibold, theme.colors.formLabel, theme.spacing.xxs),
    };
});
function Label(props) {
    var field = props.field, index = props.index;
    var value = field.values.get(index) || '';
    var styles = getLabelStyles(useTheme());
    return (React.createElement("div", { className: styles.label },
        React.createElement("div", null, field.config.displayName || field.name),
        React.createElement("span", { className: styles.value }, value)));
}
var templateObject_1, templateObject_2;
//# sourceMappingURL=useContextMenu.js.map