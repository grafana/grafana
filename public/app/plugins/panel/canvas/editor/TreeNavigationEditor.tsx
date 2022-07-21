import { css, cx } from '@emotion/css';
import { Global } from '@emotion/react';
import Tree from 'rc-tree';
import React, { Key, useEffect, useState } from 'react';
import SVG from 'react-inlinesvg';

import { GrafanaTheme2, StandardEditorProps } from '@grafana/data';
import { Icon, IconButton, useStyles2, useTheme2 } from '@grafana/ui';
import { ElementState } from 'app/features/canvas/runtime/element';

import { LayerName } from '../../../../core/components/Layers/LayerName';
import { getGlobalStyles } from '../globalStyles';
import { PanelOptions } from '../models.gen';
import { getTreeData, onNodeDrop, TreeElement } from '../tree';
import { DragNode, DropNode, LayerActionID } from '../types';
import { doSelect } from '../utils';

import { TreeViewEditorProps } from './treeViewEditor';

export const TreeNavigationEditor = ({ item }: StandardEditorProps<any, TreeViewEditorProps, PanelOptions>) => {
  const [treeData, setTreeData] = useState(getTreeData(item?.settings?.scene.root));
  const [autoExpandParent, setAutoExpandParent] = useState(true);
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);

  const theme = useTheme2();
  const globalCSS = getGlobalStyles(theme);
  const styles = useStyles2(getStyles);

  const selectedBgColor = theme.v1.colors.formInputBorderActive;
  const { settings } = item;

  useEffect(() => {
    const selection: string[] = settings?.selected ? settings.selected.map((v) => v.getName()) : [];

    setTreeData(getTreeData(item?.settings?.scene.root, selection, selectedBgColor));
  }, [item?.settings?.scene.root, selectedBgColor, settings?.selected]);

  if (!settings) {
    return <div>No settings</div>;
  }

  const layer = settings.layer;
  if (!layer) {
    return <div>Missing layer?</div>;
  }

  const getScene = () => {
    const { settings } = item;
    if (!settings?.layer) {
      return;
    }
    return settings.layer.scene;
  };

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

  const onDelete = (element: ElementState) => {
    const elLayer = element.parent ?? layer;
    elLayer.doAction(LayerActionID.Delete, element);
  };

  const onDuplicate = (element: ElementState) => {
    layer.doAction(LayerActionID.Duplicate, element);
  };

  const onNameChange = (element: ElementState, name: string) => {
    element.onChange({ ...element.options, name });
  };

  const verifyLayerNameUniqueness = (nameToVerify: string) => {
    const scene = getScene();

    return Boolean(scene?.canRename(nameToVerify));
  };

  const getLayerInfo = (element: ElementState) => {
    return element.options.type;
  };

  const renderTreeNode = (nodeData: TreeElement) => {
    const element = nodeData.dataRef;
    const name = nodeData.dataRef.getName();

    return (
      <>
        <LayerName
          name={name}
          onChange={(v) => onNameChange(element, v)}
          verifyLayerNameUniqueness={verifyLayerNameUniqueness ?? undefined}
        />
        <div className={styles.textWrapper}>&nbsp; {getLayerInfo(element)}</div>

        {!nodeData.children && (
          <>
            <IconButton
              name="copy"
              title={'Duplicate'}
              className={styles.actionIcon}
              onClick={() => onDuplicate(element)}
            />
            <IconButton
              name="trash-alt"
              title={'remove'}
              className={cx(styles.actionIcon, styles.dragIcon)}
              onClick={() => onDelete(element)}
            />
          </>
        )}

        <Icon title="Drag and drop to reorder" name="draggabledots" size="lg" className={styles.dragIcon} />
      </>
    );
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
        titleRender={renderTreeNode}
        switcherIcon={switcherIcon}
      />
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  actionIcon: css`
    color: ${theme.colors.text.secondary};
    &:hover {
      color: ${theme.colors.text.primary};
    }
  `,
  dragIcon: css`
    cursor: drag;
  `,
  textWrapper: css`
    display: flex;
    align-items: center;
    flex-grow: 1;
    overflow: hidden;
    margin-right: ${theme.v1.spacing.sm};
  `,
});
