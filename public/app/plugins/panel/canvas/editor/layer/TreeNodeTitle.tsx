import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';
import { LayerName } from 'app/core/components/Layers/LayerName';
import { ElementState } from 'app/features/canvas/runtime/element';

import { LayerActionID } from '../../types';
import { TreeViewEditorProps } from '../element/elementEditor';

import { TreeElement } from './tree';

interface Props {
  settings: TreeViewEditorProps;
  nodeData: TreeElement;
  setAllowSelection: (allow: boolean) => void;
}

export const TreeNodeTitle = ({ settings, nodeData, setAllowSelection }: Props) => {
  const element = nodeData.dataRef;
  const name = nodeData.dataRef.getName();

  const styles = useStyles2(getStyles);

  const layer = settings.layer;

  const getScene = () => {
    if (!settings?.layer) {
      return;
    }

    return settings.layer.scene;
  };

  const onDelete = (element: ElementState) => {
    const elLayer = element.parent ?? layer;
    elLayer.doAction(LayerActionID.Delete, element);
    setAllowSelection(false);
  };

  const onDuplicate = (element: ElementState) => {
    const elLayer = element.parent ?? layer;
    elLayer.doAction(LayerActionID.Duplicate, element);
    setAllowSelection(false);
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

  return (
    <>
      <LayerName
        name={name}
        onChange={(v) => onNameChange(element, v)}
        verifyLayerNameUniqueness={verifyLayerNameUniqueness ?? undefined}
      />

      <div className={styles.textWrapper}>&nbsp; {getLayerInfo(element)}</div>

      {!nodeData.children && (
        <div className={styles.actionButtonsWrapper}>
          <IconButton
            name="copy"
            title="Duplicate"
            className={styles.actionIcon}
            onClick={() => onDuplicate(element)}
            tooltip="Duplicate"
          />
          <IconButton
            name="trash-alt"
            title="remove"
            className={styles.actionIcon}
            onClick={() => onDelete(element)}
            tooltip="Remove"
          />
        </div>
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  actionButtonsWrapper: css`
    display: flex;
    align-items: flex-end;
  `,
  actionIcon: css`
    color: ${theme.colors.text.secondary};
    cursor: pointer;
    &:hover {
      color: ${theme.colors.text.primary};
    }
  `,
  textWrapper: css`
    display: flex;
    align-items: center;
    flex-grow: 1;
    overflow: hidden;
    margin-right: ${theme.spacing(1)};
  `,
  layerName: css`
    font-weight: ${theme.typography.fontWeightMedium};
    color: ${theme.colors.primary.text};
    cursor: pointer;
    overflow: hidden;
    margin-left: ${theme.spacing(0.5)};
  `,
});
