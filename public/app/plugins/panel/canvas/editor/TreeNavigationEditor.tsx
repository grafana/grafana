import { Global } from '@emotion/react';
import Tree from 'rc-tree';
import React, { Key, useEffect, useState } from 'react';
import SVG from 'react-inlinesvg';

import { StandardEditorProps } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';
import { ElementState } from 'app/features/canvas/runtime/element';

import { getGlobalStyles } from '../globalStyles';
import { PanelOptions } from '../models.gen';
import { getTreeData, onNodeDrop } from '../tree';
import { DragNode, DropNode } from '../types';
import { doSelect } from '../utils';

import { TreeViewEditorProps } from './treeViewEditor';

export const TreeNavigationEditor = ({ item }: StandardEditorProps<any, TreeViewEditorProps, PanelOptions>) => {
  const [treeData, setTreeData] = useState(getTreeData(item?.settings?.scene.root));
  const [autoExpandParent, setAutoExpandParent] = useState(true);
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);

  const theme = useTheme2();
  const globalCSS = getGlobalStyles(theme);
  const selectedBgColor = theme.colors.background.secondary;
  const { settings } = item;

  useEffect(() => {
    const selection: string[] = settings?.selected ? settings.selected.map((v) => v.getName()) : [];

    setTreeData(getTreeData(item?.settings?.scene.root, selection, selectedBgColor));
  }, [item?.settings?.scene.root, selectedBgColor, settings?.selected]);

  if (!settings) {
    return <div>No settings</div>;
  }

  const onSelect = (selectedKeys: Key[], info: { node: { dataRef: ElementState } }) => {
    if (item.settings?.scene) {
      doSelect(item.settings.scene, info.node.dataRef);
    }
  };

  const allowDrop = () => {
    return true;
  };

  const onDrop = (info: { node: DropNode; dragNode: DragNode; dropPosition: number; dropToGap: boolean }) => {
    const destPos = info.node.pos.split('-');
    const destPosition = info.dropPosition - Number(destPos[destPos.length - 1]);

    const srcEl = info.dragNode.dataRef;
    const destEl = info.node.dataRef;

    const data = onNodeDrop(info, treeData);

    setTreeData(data);
    destEl.parent?.scene.reorderElements(srcEl, destEl, info.dropToGap, destPosition);
  };

  const onExpand = (expandedKeys: Key[]) => {
    setExpandedKeys(expandedKeys);
    setAutoExpandParent(false);
  };

  const getSvgIcon = (path = '', style = {}) => <SVG src={path} title={'Node Icon'} style={{ ...style }} />;

  const switcherIcon = (obj: { isLeaf: boolean; expanded: boolean }) => {
    if (obj.isLeaf) {
      // TODO: Implement element specific icons
      return getSvgIcon('');
    }

    return getSvgIcon('public/img/icons/unicons/angle-right.svg', {
      transform: `rotate(${obj.expanded ? 90 : 0}deg)`,
      fill: theme.colors.text.primary,
    });
  };

  return (
    <>
      <Global styles={globalCSS} />
      <Tree
        selectable={true}
        onSelect={onSelect}
        draggable={true}
        defaultExpandAll={true}
        autoExpandParent={autoExpandParent}
        showIcon={false}
        allowDrop={allowDrop}
        onDrop={onDrop}
        expandedKeys={expandedKeys}
        onExpand={onExpand}
        treeData={treeData}
        switcherIcon={switcherIcon}
      />
    </>
  );
};
