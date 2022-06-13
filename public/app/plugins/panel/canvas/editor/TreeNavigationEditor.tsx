import { css } from '@emotion/css';
import { Global } from '@emotion/react';
import Tree from 'rc-tree';
import React, { Key, PureComponent } from 'react';

import { GrafanaTheme, StandardEditorProps } from '@grafana/data';
import { config } from '@grafana/runtime/src';
import { getTheme, stylesFactory } from '@grafana/ui';

import { ElementState } from '../../../../features/canvas/runtime/element';
import { FrameState } from '../../../../features/canvas/runtime/frame';
import { getGlobalStyles } from '../globalStyles';
import { PanelOptions } from '../models.gen';
import { getTreeData, TreeElement } from '../tree';
import { LayerActionID } from '../types';
import { doSelect } from '../utils';

import { TreeViewEditorProps } from './treeViewEditor';

type Props = StandardEditorProps<any, TreeViewEditorProps, PanelOptions>;

type State = {
  treeData: TreeElement[];
  autoExpandParent: boolean;
  expandedKeys: number[];
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

  globalCSS = getGlobalStyles(config.theme2);
  settings = this.props.item.settings;
  theme = getTheme();
  styles = getStyles(this.theme);
  rootElements = this.props.item?.settings?.scene.root.elements;

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

  onDrop = (info: any) => {
    const destKey = info.node.key;
    const srcKey = info.dragNode.key;
    const destPos = info.node.pos.split('-');
    const destPosition = info.dropPosition - Number(destPos[destPos.length - 1]);

    const srcEl = info.dragNode.dataRef;
    const destEl = info.node.dataRef;

    const loop = (data: TreeElement[], key: number, callback: any) => {
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
      loop(data, destKey, (item: TreeElement, index: number, arr: any[]) => {
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

    this.reorderElements(srcEl, destEl);
  };

  reorderElements = (src: ElementState, dest: ElementState) => {
    if (dest instanceof FrameState) {
      if (src.parent === dest) {
        // same Frame parent
        src.parent?.reorderTree(src, dest, true);
      } else {
        src.parent?.doAction(LayerActionID.Delete, src);
        src.parent = dest;

        const destIndex = dest.elements.length - 1;
        dest.elements.splice(destIndex, 0, src);
        dest.scene.save();

        src.updateData(dest.scene.context);
        dest.reinitializeMoveable();
      }
    }
    // else if (dest.parent instanceof FrameState) {
    //   console.log('here');
    //
    // }
    else if (src.parent === dest.parent) {
      src.parent?.reorderTree(src, dest);
    }
  };

  updateSource = (src: ElementState, dest: ElementState, isNewChild = false) => {
    src.parent?.doAction(LayerActionID.Delete, src);
    src.parent = dest instanceof FrameState && isNewChild ? dest : dest.parent;
  };

  render() {
    const { settings } = this.props.item;
    if (!settings) {
      return <div>No settings</div>;
    }

    const selection: string[] = settings.selected ? settings.selected.map((v) => v.getName()) : [];
    const treeData = getTreeData(this.props.item?.settings?.scene.root, selection, this.theme.colors.border1);

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
          treeData={treeData}
        />
      </>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    treeNodeHeader: css`
      cursor: pointer;
      font-size: 14px;

      &:hover {
        background-color: ${theme.colors.border1};
      }
    `,
    selected: css`
      background-color: ${theme.colors.border1};
    `,
  };
});
