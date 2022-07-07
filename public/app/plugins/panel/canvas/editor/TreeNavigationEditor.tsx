import { Global } from '@emotion/react';
import Tree from 'rc-tree';
import React, { Key, PureComponent } from 'react';
import SVG from 'react-inlinesvg';

import { StandardEditorProps } from '@grafana/data';
import { config } from '@grafana/runtime/src';
import { getTheme } from '@grafana/ui';

import { ElementState } from '../../../../features/canvas/runtime/element';
import { FrameState } from '../../../../features/canvas/runtime/frame';
import { RootElement } from '../../../../features/canvas/runtime/root';
import { getGlobalStyles } from '../globalStyles';
import { PanelOptions } from '../models.gen';
import { getTreeData, TreeElement } from '../tree';
import { DragNode, DropNode, LayerActionID } from '../types';
import { doSelect } from '../utils';

import { TreeViewEditorProps } from './treeViewEditor';

type Props = StandardEditorProps<any, TreeViewEditorProps, PanelOptions>;

type State = {
  treeData: TreeElement[];
  autoExpandParent: boolean;
  expandedKeys: Key[];
};

export class TreeNavigationEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      treeData: getTreeData(props.item?.settings?.scene.root),
      autoExpandParent: true,
      expandedKeys: [],
    };
  }

  globalCSS = getGlobalStyles(config.theme);
  settings = this.props.item.settings;
  theme = getTheme();
  rootElements = this.props.item?.settings?.scene.root.elements;
  selectedBgColor = this.theme.colors.border1;

  onSelect = (selectedKeys: Key[], info: any) => {
    doSelect(this.settings, info.node.dataRef);
  };

  allowDrop = (info: any) => {
    if (!info.dropNode.children) {
      if (info.dropPosition === 0) {
        return false;
      }
    }
    return true;
  };

  onDrop = (info: { node: DropNode; dragNode: DragNode; dropPosition: number; dropToGap: boolean }) => {
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
    const data = [...this.state.treeData];

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

    this.setState({
      treeData: data,
    });

    this.reorderElements(srcEl, destEl, info.dropToGap, destPosition);
  };

  // @TODO refactor and re-test cases
  reorderElements = (src: ElementState, dest: ElementState, dragToGap: boolean, destPosition: number) => {
    if (dragToGap) {
      if (destPosition === -1) {
        // top of the tree
        if (src.parent instanceof FrameState) {
          if (dest.parent) {
            this.updateElements(src, dest.parent, dest.parent.elements.length);
            src.updateData(dest.parent.scene.context);
          }
        } else {
          dest.parent?.reorderTree(src, dest, true);
        }
      } else {
        if (dest.parent) {
          this.updateElements(src, dest.parent, dest.parent.elements.indexOf(dest));
          src.updateData(dest.parent.scene.context);
        }
      }
    } else {
      if (dest instanceof FrameState) {
        if (src.parent === dest) {
          // same Frame parent
          src.parent?.reorderTree(src, dest, true);
        } else {
          this.updateElements(src, dest);
          src.updateData(dest.scene.context);
        }
      } else if (src.parent === dest.parent) {
        src.parent?.reorderTree(src, dest);
      } else {
        if (dest.parent) {
          this.updateElements(src, dest.parent);
          src.updateData(dest.parent.scene.context);
        }
      }
    }
  };

  updateElements = (src: ElementState, dest: FrameState | RootElement, idx: number | null = null) => {
    src.parent?.doAction(LayerActionID.Delete, src);
    src.parent = dest;

    const elementContainer = src.div?.getBoundingClientRect();
    src.setPlacementFromConstraint(elementContainer, dest.div?.getBoundingClientRect());

    const destIndex = idx ?? dest.elements.length - 1;
    dest.elements.splice(destIndex, 0, src);
    dest.scene.save();

    dest.reinitializeMoveable();
  };

  onExpand = (expandedKeys: Key[]) => {
    this.setState({
      expandedKeys,
      autoExpandParent: false,
    });
  };

  getSvgIcon = (path = '', style = {}) => <SVG src={path} title={'Node Icon'} style={{ ...style }} />;

  render() {
    const { settings } = this.props.item;
    if (!settings) {
      return <div>No settings</div>;
    }

    const selection: string[] = settings.selected ? settings.selected.map((v) => v.getName()) : [];
    const treeData = getTreeData(this.props.item?.settings?.scene.root, selection, this.theme.colors.border1);

    const switcherIcon = (obj: { isLeaf: boolean; expanded: boolean }) => {
      if (obj.isLeaf) {
        return this.getSvgIcon('');
      }

      return this.getSvgIcon('public/img/icons/unicons/angle-right.svg', {
        transform: `rotate(${obj.expanded ? 90 : 0}deg)`,
        fill: this.theme.colors.text,
      });
    };

    return (
      <>
        <Global styles={this.globalCSS} />
        <Tree
          selectable={true}
          onSelect={this.onSelect}
          draggable={true}
          defaultExpandAll={true}
          autoExpandParent={this.state.autoExpandParent}
          showIcon={false}
          allowDrop={this.allowDrop}
          onDrop={this.onDrop}
          expandedKeys={this.state.expandedKeys}
          onExpand={this.onExpand}
          treeData={treeData}
          switcherIcon={switcherIcon}
        />
      </>
    );
  }
}
