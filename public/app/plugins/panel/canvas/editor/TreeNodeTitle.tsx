import { css, cx } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';
import { ElementState } from 'app/features/canvas/runtime/element';

import { EditLayerName } from '../../../../core/components/Layers/EditLayerName';
import { TreeElement } from '../tree';
import { LayerActionID } from '../types';

import { TreeViewEditorProps } from './treeViewEditor';

interface Props {
  settings: TreeViewEditorProps;
  nodeData: TreeElement;
  setAllowSelection: (allow: boolean) => void;
}

export const TreeNodeTitle = ({ settings, nodeData, setAllowSelection }: Props) => {
  const [editElementId, setEditElementId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const element = nodeData.dataRef;
  const name = nodeData.dataRef.getName();
  const UID = nodeData.dataRef.UID;

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

  const onEdit = (element: ElementState) => {
    setEditElementId(element.UID);
    setIsEditing(!isEditing);
  };

  return (
    <>
      <EditLayerName
        name={name}
        UID={UID}
        editElementId={editElementId}
        isEditing={isEditing}
        onChange={(v: string) => onNameChange(element, v)}
        setEditElementId={setEditElementId}
        verifyLayerNameUniqueness={verifyLayerNameUniqueness ?? undefined}
      />

      <div className={styles.textWrapper}>&nbsp; {getLayerInfo(element)}</div>

      <IconButton name="pen" className={styles.actionIcon} size="sm" onClick={() => onEdit(element)} />
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
  wrapper: css`
    label: Wrapper;
    display: flex;
    align-items: center;
    margin-left: ${theme.v1.spacing.xs};
  `,
  layerName: css`
    font-weight: ${theme.v1.typography.weight.semibold};
    color: ${theme.v1.colors.textBlue};
    cursor: pointer;
    overflow: hidden;
    margin-left: ${theme.v1.spacing.xs};
  `,
  layerNameInput: css`
    max-width: 300px;
    margin: -4px 0;
  `,
});
