import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';
import { ContextMenu, MenuGroup, MenuItem, useStyles2 } from '@grafana/ui';
import { getEdgeFields, getNodeFields, statToString } from './utils';
/**
 * Hook that contains state of the context menu, both for edges and nodes and provides appropriate component when
 * opened context menu should be opened.
 */
export function useContextMenu(getLinks, 
// This can be undefined if we only use edge dataframe
nodes, 
// This can be undefined if we have only single node
edges, config, setConfig, setFocusedNodeId) {
    const [menu, setMenu] = useState(undefined);
    const onNodeOpen = useCallback((event, node) => {
        const [label, showGridLayout] = config.gridLayout
            ? ['Show in Graph layout', false]
            : ['Show in Grid layout', true];
        const extraNodeItem = [
            {
                label: label,
                onClick: (node) => {
                    setFocusedNodeId(node.id);
                    setConfig(Object.assign(Object.assign({}, config), { gridLayout: showGridLayout }));
                    setMenu(undefined);
                },
            },
        ];
        const links = nodes ? getLinks(nodes, node.dataFrameRowIndex) : [];
        const renderer = getItemsRenderer(links, node, extraNodeItem);
        setMenu(makeContextMenu(React.createElement(NodeHeader, { node: node, nodes: nodes }), event, setMenu, renderer));
    }, [config, nodes, getLinks, setMenu, setConfig, setFocusedNodeId]);
    const onEdgeOpen = useCallback((event, edge) => {
        if (!edges) {
            // This could happen if we have only one node and no edges, in which case this is not needed as there is no edge
            // to click on.
            return;
        }
        const links = getLinks(edges, edge.dataFrameRowIndex);
        const renderer = getItemsRenderer(links, edge);
        setMenu(makeContextMenu(React.createElement(EdgeHeader, { edge: edge, edges: edges }), event, setMenu, renderer));
    }, [edges, getLinks, setMenu]);
    return { onEdgeOpen, onNodeOpen, MenuComponent: menu };
}
function makeContextMenu(header, event, setMenu, renderer) {
    return (React.createElement(ContextMenu, { renderHeader: () => header, renderMenuItems: renderer, onClose: () => setMenu(undefined), x: event.pageX, y: event.pageY }));
}
function getItemsRenderer(links, item, extraItems) {
    if (!(links.length || (extraItems === null || extraItems === void 0 ? void 0 : extraItems.length))) {
        return undefined;
    }
    const items = getItems(links);
    return () => {
        let groups = items === null || items === void 0 ? void 0 : items.map((group, index) => (React.createElement(MenuGroup, { key: `${group.label}${index}`, label: group.label }, (group.items || []).map(mapMenuItem(item)))));
        if (extraItems) {
            groups = [...extraItems.map(mapMenuItem(item)), ...groups];
        }
        return groups;
    };
}
function mapMenuItem(item) {
    return function NodeGraphMenuItem(link) {
        return (React.createElement(MenuItem, { key: link.label, url: link.url, label: link.label, ariaLabel: link.ariaLabel, onClick: link.onClick
                ? (event) => {
                    var _a;
                    if (!((event === null || event === void 0 ? void 0 : event.ctrlKey) || (event === null || event === void 0 ? void 0 : event.metaKey) || (event === null || event === void 0 ? void 0 : event.shiftKey))) {
                        event === null || event === void 0 ? void 0 : event.preventDefault();
                        event === null || event === void 0 ? void 0 : event.stopPropagation();
                        (_a = link.onClick) === null || _a === void 0 ? void 0 : _a.call(link, item);
                    }
                }
                : undefined, target: '_self' }));
    };
}
function getItems(links) {
    const defaultGroup = 'Open in Explore';
    const groups = links.reduce((acc, l) => {
        let group;
        let title;
        if (l.title.indexOf('/') !== -1) {
            group = l.title.split('/')[0];
            title = l.title.split('/')[1];
            acc[group] = acc[group] || [];
            acc[group].push({ l, newTitle: title });
        }
        else {
            acc[defaultGroup] = acc[defaultGroup] || [];
            acc[defaultGroup].push({ l });
        }
        return acc;
    }, {});
    return Object.keys(groups).map((key) => {
        return {
            label: key,
            ariaLabel: key,
            items: groups[key].map((link) => ({
                label: link.newTitle || link.l.title,
                ariaLabel: link.newTitle || link.l.title,
                url: link.l.href,
                onClick: link.l.onClick,
            })),
        };
    });
}
function FieldRow({ field, index }) {
    var _a;
    return (React.createElement(HeaderRow, { label: ((_a = field.config) === null || _a === void 0 ? void 0 : _a.displayName) || field.name, value: statToString(field.config, field.values[index] || '') }));
}
function HeaderRow({ label, value }) {
    const styles = useStyles2(getLabelStyles);
    return (React.createElement("tr", null,
        React.createElement("td", { className: styles.label },
            label,
            ": "),
        React.createElement("td", { className: styles.value }, value)));
}
/**
 * Shows some field values in a table on top of the context menu.
 */
function NodeHeader({ node, nodes }) {
    const rows = [];
    if (nodes) {
        const fields = getNodeFields(nodes);
        for (const f of [fields.title, fields.subTitle, fields.mainStat, fields.secondaryStat, ...fields.details]) {
            if (f && f.values[node.dataFrameRowIndex]) {
                rows.push(React.createElement(FieldRow, { key: f.name, field: f, index: node.dataFrameRowIndex }));
            }
        }
    }
    else {
        // Fallback if we don't have nodes dataFrame. Can happen if we use just the edges frame to construct this.
        if (node.title) {
            rows.push(React.createElement(HeaderRow, { key: "title", label: 'Title', value: node.title }));
        }
        if (node.subTitle) {
            rows.push(React.createElement(HeaderRow, { key: "subtitle", label: 'Subtitle', value: node.subTitle }));
        }
    }
    return (React.createElement("table", { style: { width: '100%' } },
        React.createElement("tbody", null, rows)));
}
/**
 * Shows some of the field values in a table on top of the context menu.
 */
function EdgeHeader(props) {
    var _a, _b;
    const index = props.edge.dataFrameRowIndex;
    const fields = getEdgeFields(props.edges);
    const valueSource = ((_a = fields.source) === null || _a === void 0 ? void 0 : _a.values[index]) || '';
    const valueTarget = ((_b = fields.target) === null || _b === void 0 ? void 0 : _b.values[index]) || '';
    const rows = [];
    if (valueSource && valueTarget) {
        rows.push(React.createElement(HeaderRow, { key: 'header-row', label: 'Source → Target', value: `${valueSource} → ${valueTarget}` }));
    }
    for (const f of [fields.mainStat, fields.secondaryStat, ...fields.details]) {
        if (f && f.values[index]) {
            rows.push(React.createElement(FieldRow, { key: `field-row-${index}`, field: f, index: index }));
        }
    }
    return (React.createElement("table", { style: { width: '100%' } },
        React.createElement("tbody", null, rows)));
}
export const getLabelStyles = (theme) => {
    return {
        label: css `
      label: Label;
      line-height: 1.25;
      color: ${theme.colors.text.disabled};
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.fontWeightMedium};
      padding-right: ${theme.spacing(1)};
    `,
        value: css `
      label: Value;
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.fontWeightMedium};
      color: ${theme.colors.text.primary};
    `,
    };
};
//# sourceMappingURL=useContextMenu.js.map