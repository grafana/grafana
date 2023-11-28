import { css } from '@emotion/css';
import { Global } from '@emotion/react';
import Tree from 'rc-tree';
import React, { useEffect, useMemo, useState } from 'react';
import { config } from '@grafana/runtime';
import { Button, HorizontalGroup, Icon, useStyles2, useTheme2 } from '@grafana/ui';
import { AddLayerButton } from 'app/core/components/Layers/AddLayerButton';
import { getGlobalStyles } from '../../globalStyles';
import { doSelect, getElementTypes, onAddItem } from '../../utils';
import { TreeNodeTitle } from './TreeNodeTitle';
import { getTreeData, onNodeDrop } from './tree';
let allowSelection = true;
export const TreeNavigationEditor = ({ item }) => {
    var _a, _b;
    const [treeData, setTreeData] = useState(getTreeData((_a = item === null || item === void 0 ? void 0 : item.settings) === null || _a === void 0 ? void 0 : _a.scene.root));
    const [autoExpandParent, setAutoExpandParent] = useState(true);
    const [expandedKeys, setExpandedKeys] = useState([]);
    const [selectedKeys, setSelectedKeys] = useState([]);
    const theme = useTheme2();
    const globalCSS = getGlobalStyles(theme);
    const styles = useStyles2(getStyles);
    const selectedBgColor = theme.colors.primary.border;
    const { settings } = item;
    const selection = useMemo(() => ((settings === null || settings === void 0 ? void 0 : settings.selected) ? settings.selected.map((v) => v === null || v === void 0 ? void 0 : v.getName()) : []), [settings === null || settings === void 0 ? void 0 : settings.selected]);
    const selectionByUID = useMemo(() => ((settings === null || settings === void 0 ? void 0 : settings.selected) ? settings.selected.map((v) => v === null || v === void 0 ? void 0 : v.UID) : []), [settings === null || settings === void 0 ? void 0 : settings.selected]);
    useEffect(() => {
        var _a;
        setTreeData(getTreeData((_a = item === null || item === void 0 ? void 0 : item.settings) === null || _a === void 0 ? void 0 : _a.scene.root, selection, selectedBgColor));
        setSelectedKeys(selectionByUID);
        setAllowSelection();
    }, [(_b = item === null || item === void 0 ? void 0 : item.settings) === null || _b === void 0 ? void 0 : _b.scene.root, selectedBgColor, selection, selectionByUID]);
    if (!settings) {
        return React.createElement("div", null, "No settings");
    }
    const layer = settings.layer;
    if (!layer) {
        return React.createElement("div", null, "Missing layer?");
    }
    const onSelect = (selectedKeys, info) => {
        var _a;
        if (allowSelection && ((_a = item.settings) === null || _a === void 0 ? void 0 : _a.scene)) {
            doSelect(item.settings.scene, info.node.dataRef);
        }
    };
    const allowDrop = () => {
        return true;
    };
    const onDrop = (info) => {
        var _a;
        const destPos = info.node.pos.split('-');
        const destPosition = info.dropPosition - Number(destPos[destPos.length - 1]);
        const srcEl = info.dragNode.dataRef;
        const destEl = info.node.dataRef;
        const data = onNodeDrop(info, treeData);
        setTreeData(data);
        (_a = destEl.parent) === null || _a === void 0 ? void 0 : _a.scene.reorderElements(srcEl, destEl, info.dropToGap, destPosition);
    };
    const onExpand = (expandedKeys) => {
        setExpandedKeys(expandedKeys);
        setAutoExpandParent(false);
    };
    const switcherIcon = (obj) => {
        if (obj.isLeaf) {
            // TODO: Implement element specific icons
            return React.createElement(React.Fragment, null);
        }
        return (React.createElement(Icon, { name: "angle-right", title: 'Node Icon', style: {
                transform: `rotate(${obj.expanded ? 90 : 0}deg)`,
                fill: theme.colors.text.primary,
            } }));
    };
    const setAllowSelection = (allow = true) => {
        allowSelection = allow;
    };
    const onClearSelection = () => {
        layer.scene.clearCurrentSelection();
    };
    const onTitleRender = (nodeData) => {
        return React.createElement(TreeNodeTitle, { nodeData: nodeData, setAllowSelection: setAllowSelection, settings: settings });
    };
    // TODO: This functionality is currently kinda broken / no way to decouple / delete created frames at this time
    const onFrameSelection = () => {
        if (layer.scene) {
            layer.scene.frameSelection();
        }
        else {
            console.warn('no scene!');
        }
    };
    const typeOptions = getElementTypes(settings.scene.shouldShowAdvancedTypes).options;
    return (React.createElement(React.Fragment, null,
        React.createElement(Global, { styles: globalCSS }),
        React.createElement(Tree, { selectable: true, onSelect: onSelect, draggable: true, defaultExpandAll: true, autoExpandParent: autoExpandParent, showIcon: false, allowDrop: allowDrop, onDrop: onDrop, expandedKeys: expandedKeys, onExpand: onExpand, treeData: treeData, titleRender: onTitleRender, switcherIcon: switcherIcon, selectedKeys: selectedKeys, multiple: true }),
        React.createElement(HorizontalGroup, { justify: "space-between" },
            React.createElement("div", { className: styles.addLayerButton },
                React.createElement(AddLayerButton, { onChange: (sel) => onAddItem(sel, layer), options: typeOptions, label: 'Add item' })),
            selection.length > 0 && (React.createElement(Button, { size: "sm", variant: "secondary", onClick: onClearSelection }, "Clear selection")),
            selection.length > 1 && config.featureToggles.canvasPanelNesting && (React.createElement(Button, { size: "sm", variant: "secondary", onClick: onFrameSelection }, "Frame selection")))));
};
const getStyles = (theme) => ({
    addLayerButton: css `
    margin-left: 18px;
    min-width: 150px;
  `,
});
//# sourceMappingURL=TreeNavigationEditor.js.map