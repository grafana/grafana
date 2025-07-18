import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
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
            title={t('canvas.tree-node-title.title-duplicate', 'Duplicate')}
            className={styles.actionIcon}
            onClick={() => onDuplicate(element)}
            tooltip={t('canvas.tree-node-title.tooltip-duplicate', 'Duplicate')}
          />
          <IconButton
            name="trash-alt"
            title={t('canvas.tree-node-title.title-remove', 'Remove')}
            className={styles.actionIcon}
            onClick={() => onDelete(element)}
            tooltip={t('canvas.tree-node-title.tooltip-remove', 'Remove')}
          />
        </div>
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  actionButtonsWrapper: css({
    display: 'flex',
    alignItems: 'flex-end',
  }),
  actionIcon: css({
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
  textWrapper: css({
    display: 'flex',
    alignItems: 'center',
    flexGrow: 1,
    overflow: 'hidden',
    marginRight: theme.spacing(1),
  }),
  layerName: css({
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.primary.text,
    cursor: 'pointer',
    overflow: 'hidden',
    marginLeft: theme.spacing(0.5),
  }),
});
