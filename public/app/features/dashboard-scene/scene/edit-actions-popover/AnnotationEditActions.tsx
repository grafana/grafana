import { useCallback } from 'react';

import { t } from '@grafana/i18n';
import { type SceneDataLayerProvider } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import {
  DeleteActionButton,
  DuplicateActionButton,
  EditActionButton,
  getActionStyles,
  SettingsActionButton,
} from './EditActions';
import { useEditActionsPopover } from './EditActionsPopover';

export function AnnotationEditActions({
  layer,
  onClickEdit,
  onClickEditQuery,
  onClickDuplicate,
  onClickDelete,
}: {
  layer: SceneDataLayerProvider;
  onClickEdit: () => void;
  onClickEditQuery: () => void;
  onClickDuplicate: () => void;
  onClickDelete: () => void;
}) {
  const styles = useStyles2(getActionStyles);
  const { closePopover } = useEditActionsPopover();

  const onClickEditQueryInternal = useCallback(() => {
    closePopover();
    onClickEditQuery();
  }, [onClickEditQuery, closePopover]);

  return (
    <>
      <SettingsActionButton
        tooltip={t('dashboard-scene.annotation-edit-actions.tooltip-edit-annotation-settings', 'Annotation settings')}
        onClick={onClickEdit}
      />
      <EditActionButton
        onClick={onClickEditQueryInternal}
        tooltip={t('dashboard-scene.annotation-edit-actions.tooltip-edit-annotation-query', 'Edit query')}
      />
      <div className={styles.actionsDivider} />
      <DuplicateActionButton onClick={onClickDuplicate} />
      <DeleteActionButton
        title={t('dashboard-scene.annotation-editable-element.delete-title', 'Delete annotation query')}
        text={t(
          'dashboard-scene.annotation-editable-element.delete-text',
          'Are you sure you want to delete: {{name}}?',
          { name: layer.state.name }
        )}
        yesText={t('dashboard-scene.annotation-editable-element.delete-confirm', 'Delete annotation query')}
        onConfirm={onClickDelete}
      />
    </>
  );
}
