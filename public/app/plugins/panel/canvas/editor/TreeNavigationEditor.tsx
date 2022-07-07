import { Global } from '@emotion/react';
import Tree from 'rc-tree';
import React, { Key, useEffect, useState } from 'react';
import SVG from 'react-inlinesvg';

import { StandardEditorProps } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';
import { ElementState } from 'app/features/canvas/runtime/element';
import { FrameState } from 'app/features/canvas/runtime/frame';
import { RootElement } from 'app/features/canvas/runtime/root';

import { getGlobalStyles } from '../globalStyles';
import { PanelOptions } from '../models.gen';
import { getTreeData, TreeElement } from '../tree';
import { DragNode, DropNode, LayerActionID } from '../types';
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

  const onSelect = (selectedKeys: Key[], info: any) => {
    doSelect(item.settings, info.node.dataRef);
  };

  const allowDrop = () => {
    return true;
  };

  const onDrop = (info: { node: DropNode; dragNode: DragNode; dropPosition: number; dropToGap: boolean }) => {
    const destKey = info.node.key;
    const srcKey = info.dragNode.key;
    const destPos = info.node.pos.split('-');
    const destPosition = info.dropPosition - Number(destPos[destPos.length - 1]);

    const srcEl = info.dragNode.dataRef;
    const destEl = info.node.dataRef;

    const loop = (
      data: TreeElement[],
      key: number,
      callback: { (item: TreeElement, index: number, arr: TreeElement[]): void }
    ) => {
      data.forEach((item, index, arr) => {
        if (item.key === key) {
          callback(item, index, arr);
          return;
        }
        if (item.children) {
          loop(item.children, key, callback);
        }
      });
    };
    const data = [...treeData];

    // Find dragObject
    let srcElement: TreeElement;
    loop(data, srcKey, (item: TreeElement, index: number, arr: TreeElement[]) => {
      arr.splice(index, 1);
      srcElement = item;
    });

    if (destPosition === 0) {
      // Drop on the content
      loop(data, destKey, (item: TreeElement) => {
        item.children = item.children || [];
        item.children.unshift(srcElement);
      });
    } else {
      // Drop on the gap (insert before or insert after)
      let ar;
      let i: number;
      loop(data, destKey, (item: TreeElement, index: number, arr: TreeElement[]) => {
        ar = arr;
        i = index;
      });

      if (destPosition === -1) {
        // @ts-ignore
        ar.splice(i, 0, srcElement);
      } else {
        // @ts-ignore
        ar.splice(i + 1, 0, srcElement);
      }
    }

    setTreeData(data);
    reorderElements(srcEl, destEl, info.dropToGap, destPosition);
  };

  // @TODO refactor and re-test cases
  const reorderElements = (src: ElementState, dest: ElementState, dragToGap: boolean, destPosition: number) => {
    if (dragToGap) {
      if (destPosition === -1) {
        // top of the tree
        if (src.parent instanceof FrameState) {
          if (dest.parent) {
            updateElements(src, dest.parent, dest.parent.elements.length);
            src.updateData(dest.parent.scene.context);
          }
        } else {
          dest.parent?.reorderTree(src, dest, true);
        }
      } else {
        if (dest.parent) {
          updateElements(src, dest.parent, dest.parent.elements.indexOf(dest));
          src.updateData(dest.parent.scene.context);
        }
      }
    } else {
      if (dest instanceof FrameState) {
        if (src.parent === dest) {
          // same Frame parent
          src.parent?.reorderTree(src, dest, true);
        } else {
          updateElements(src, dest);
          src.updateData(dest.scene.context);
        }
      } else if (src.parent === dest.parent) {
        src.parent?.reorderTree(src, dest);
      } else {
        if (dest.parent) {
          updateElements(src, dest.parent);
          src.updateData(dest.parent.scene.context);
        }
      }
    }
  };

  const updateElements = (src: ElementState, dest: FrameState | RootElement, idx: number | null = null) => {
    src.parent?.doAction(LayerActionID.Delete, src);
    src.parent = dest;

    const elementContainer = src.div?.getBoundingClientRect();
    src.setPlacementFromConstraint(elementContainer, dest.div?.getBoundingClientRect());

    const destIndex = idx ?? dest.elements.length - 1;
    dest.elements.splice(destIndex, 0, src);
    dest.scene.save();

    dest.reinitializeMoveable();
  };

  const onExpand = (expandedKeys: Key[]) => {
    setExpandedKeys(expandedKeys);
    setAutoExpandParent(false);
  };

  const getSvgIcon = (path = '', style = {}) => <SVG src={path} title={'Node Icon'} style={{ ...style }} />;

  const switcherIcon = (obj: { isLeaf: boolean; expanded: boolean }) => {
    if (obj.isLeaf) {
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
