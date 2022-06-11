import { css } from '@emotion/css';
import { Global } from '@emotion/react';
import Tree, { TreeNode } from 'rc-tree';
import React, { Key, PureComponent } from 'react';

import { GrafanaTheme, StandardEditorProps } from '@grafana/data';
import { config } from '@grafana/runtime/src';
import { getTheme, stylesFactory } from '@grafana/ui';

import { getGlobalStyles } from '../globalStyles';
import { PanelOptions } from '../models.gen';
import { getTreeData, TreeElement } from '../tree';
import { doSelect } from '../utils';

import { TreeViewEditorProps } from './treeViewEditor';

type Props = StandardEditorProps<any, TreeViewEditorProps, PanelOptions>;

type State = {
  treeData: TreeElement[];
  refresh: boolean;
  autoExpandParent: boolean;
  expandedKeys: number[];
};

export class TreeNavigationEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      treeData: getTreeData(props.item?.settings?.scene.root),
      refresh: false,
      autoExpandParent: true,
      expandedKeys: [],
    };
  }

  globalCSS = getGlobalStyles(config.theme2);
  settings = this.props.item.settings;
  styles = getStyles(getTheme());
  rootElements = this.props.item?.settings?.scene.root.elements;

  onSelect = (selectedKeys: Key[], info: any) => {
    doSelect(this.settings, info.node.dataRef);
  };

  getSelectedClass = (isSelected: boolean) => {
    return isSelected ? `${this.styles.treeNodeHeader} ${this.styles.selected}` : this.styles.treeNodeHeader;
  };

  renderTreeNodes = (elements: any[], selection: string[]) =>
    elements.map((element) => {
      const isSelected = Boolean(selection?.includes(element.getName()));
      if (element.elements) {
        return (
          // @ts-ignore dataRef for current ElementState
          <TreeNode
            title={element.getName()}
            key={element.UID}
            dataRef={element}
            className={this.getSelectedClass(isSelected)}
          >
            {this.renderTreeNodes(element.elements, selection)}
          </TreeNode>
        );
      }

      // @ts-ignore
      return (
        <TreeNode
          key={element.UID}
          title={element.getName()}
          dataRef={element}
          className={this.getSelectedClass(isSelected)}
        />
      );
    });

  render() {
    const { settings } = this.props.item;
    if (!settings) {
      return <div>No settings</div>;
    }

    const selection: string[] = settings.selected ? settings.selected.map((v) => v.getName()) : [];

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
        >
          {this.renderTreeNodes(this.rootElements, selection)}
        </Tree>
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
