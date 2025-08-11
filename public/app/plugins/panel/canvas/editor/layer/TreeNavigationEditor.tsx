import { css } from '@emotion/css';
import { Global } from '@emotion/react';
import Tree, { TreeNodeProps } from 'rc-tree';
import { Key, useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2, StandardEditorProps } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, Icon, Stack, useStyles2, useTheme2 } from '@grafana/ui';
import { AddLayerButton } from 'app/core/components/Layers/AddLayerButton';
import { ElementState } from 'app/features/canvas/runtime/element';
import { frameSelection, reorderElements } from 'app/features/canvas/runtime/sceneElementManagement';

import { getGlobalStyles } from '../../globalStyles';
import { Options } from '../../panelcfg.gen';
import { DragNode, DropNode } from '../../types';
import { doSelect, getElementTypes, onAddItem } from '../../utils';
import { TreeViewEditorProps } from '../element/elementEditor';

import { TreeNodeTitle } from './TreeNodeTitle';
import { getTreeData, onNodeDrop, TreeElement } from './tree';

let allowSelection = true;

export const TreeNavigationEditor = ({ item }: StandardEditorProps<unknown, TreeViewEditorProps, Options>) => {
  const [treeData, setTreeData] = useState(getTreeData(item?.settings?.scene.root));
  const [autoExpandParent, setAutoExpandParent] = useState(true);
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);

  const theme = useTheme2();
  const globalCSS = getGlobalStyles(theme);
  const styles = useStyles2(getStyles);

  const selectedBgColor = theme.colors.primary.border;
  const { settings } = item;
  const selection = useMemo(
    () => (settings?.selected ? settings.selected.map((v) => v?.getName()) : []),
    [settings?.selected]
  );

  const selectionByUID = useMemo(
    () => (settings?.selected ? settings.selected.map((v) => v?.UID) : []),
    [settings?.selected]
  );

  useEffect(() => {
    setTreeData(getTreeData(item?.settings?.scene.root, selection, selectedBgColor));
    setSelectedKeys(selectionByUID);
    setAllowSelection();
  }, [item?.settings?.scene.root, selectedBgColor, selection, selectionByUID]);

  if (!settings) {
    return (
      <div>
        <Trans i18nKey="canvas.tree-navigation-editor.no-settings">No settings</Trans>
      </div>
    );
  }

  const layer = settings.layer;
  if (!layer) {
    return (
      <div>
        <Trans i18nKey="canvas.tree-navigation-editor.missing-layer">Missing layer?</Trans>
      </div>
    );
  }

  const onSelect = (selectedKeys: Key[], info: { node: { dataRef: ElementState } }) => {
    if (allowSelection && item.settings?.scene) {
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
    reorderElements(srcEl, destEl, info.dropToGap, destPosition);
  };

  const onExpand = (expandedKeys: Key[]) => {
    setExpandedKeys(expandedKeys);
    setAutoExpandParent(false);
  };

  const switcherIcon = (obj: TreeNodeProps) => {
    if (obj.isLeaf) {
      // TODO: Implement element specific icons
      return <></>;
    }

    return (
      <Icon
        name="angle-right"
        title={t('canvas.tree-navigation-editor.switcher-icon.title-node-icon', 'Node Icon')}
        style={{
          transform: `rotate(${obj.expanded ? 90 : 0}deg)`,
          fill: theme.colors.text.primary,
        }}
      />
    );
  };

  const setAllowSelection = (allow = true) => {
    allowSelection = allow;
  };

  const onClearSelection = () => {
    layer.scene.clearCurrentSelection();
  };

  const onTitleRender = (nodeData: TreeElement) => {
    return <TreeNodeTitle nodeData={nodeData} setAllowSelection={setAllowSelection} settings={settings} />;
  };

  // TODO: This functionality is currently kinda broken / no way to decouple / delete created frames at this time
  const onFrameSelection = () => {
    if (layer.scene) {
      frameSelection(layer.scene);
    } else {
      console.warn('no scene!');
    }
  };

  const typeOptions = getElementTypes(settings.scene.shouldShowAdvancedTypes).options;

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
        titleRender={onTitleRender}
        switcherIcon={switcherIcon}
        selectedKeys={selectedKeys}
        multiple={true}
      />

      <Stack justifyContent="space-between" direction="row">
        <div className={styles.addLayerButton}>
          <AddLayerButton
            onChange={(sel) => onAddItem(sel, layer)}
            options={typeOptions}
            label={t('canvas.tree-navigation-editor.label-add-item', 'Add item')}
          />
        </div>
        {selection.length > 0 && (
          <Button size="sm" variant="secondary" onClick={onClearSelection}>
            <Trans i18nKey="canvas.tree-navigation-editor.clear-selection">Clear selection</Trans>
          </Button>
        )}
        {selection.length > 1 && config.featureToggles.canvasPanelNesting && (
          <Button size="sm" variant="secondary" onClick={onFrameSelection}>
            <Trans i18nKey="canvas.tree-navigation-editor.frame-selection">Frame selection</Trans>
          </Button>
        )}
      </Stack>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  addLayerButton: css({
    marginLeft: '18px',
    minWidth: '150px',
  }),
});
