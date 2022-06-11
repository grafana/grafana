import { Global } from '@emotion/react';
import Tree from 'rc-tree';
import React, { Key, PureComponent } from 'react';

import { StandardEditorProps } from '@grafana/data';
import { config } from '@grafana/runtime/src';

import { getGlobalStyles } from '../globalStyles';
import { PanelOptions } from '../models.gen';
import { getTreeData, TreeNode } from '../tree';
import { doSelect } from '../utils';

import { TreeViewEditorProps } from './treeViewEditor';

type Props = StandardEditorProps<any, TreeViewEditorProps, PanelOptions>;

type State = {
  treeData: TreeNode[];
  refresh: boolean;
  autoExpandParent: boolean;
  expandedKeys: number[];
  selectedKeys: Key[];
};

export class TreeNavigationEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      treeData: getTreeData(props.item?.settings?.scene.root),
      refresh: false,
      autoExpandParent: true,
      expandedKeys: [],
      selectedKeys: [],
    };
  }

  globalCSS = getGlobalStyles(config.theme2);
  settings = this.props.item.settings;

  onSelect = (selectedKeys: Key[], info: any) => {
    this.setState({ selectedKeys });
    doSelect(this.settings, info.node.dataRef);
  };

  render() {
    const { settings } = this.props.item;
    if (!settings) {
      return <div>No settings</div>;
    }

    return (
      <>
        <Global styles={this.globalCSS} />
        <Tree
          selectable={true}
          onSelect={this.onSelect}
          defaultExpandAll
          autoExpandParent={this.state.autoExpandParent}
          draggable
          showIcon={false}
          treeData={this.state.treeData}
        />
      </>
    );
  }
}
