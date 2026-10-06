import { cx } from '@emotion/css';
import { useCallback } from 'react';

import { t } from '@grafana/i18n';
import { CustomVariable, QueryVariable, type SceneVariable } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';

import { DeleteActionButton, DuplicateActionButton, getActionStyles, SettingsActionButton } from './EditActions';
import { useEditActionsPopover } from './EditActionsPopover';

export function VariableEditActions({
  variable,
  onClickEdit,
  onClickEditQuery,
  onClickDuplicate,
  onClickDelete,
  removeOnly = false,
}: {
  variable: SceneVariable;
  onClickEdit: () => void;
  onClickEditQuery: () => void;
  onClickDuplicate: () => void;
  onClickDelete: () => void;
  /** Global and folder variables can only be opted out (removed) of this dashboard. */
  removeOnly?: boolean;
}) {
  const styles = useStyles2(getActionStyles);
  const { closePopover } = useEditActionsPopover();
  const hasQueryEditor = !removeOnly && (variable instanceof QueryVariable || variable instanceof CustomVariable);

  const onClickEditQueryInternal = useCallback(() => {
    closePopover();
    onClickEditQuery();
  }, [onClickEditQuery, closePopover]);

  if (removeOnly) {
    return (
      <>
        <Button
          fill="text"
          variant="secondary"
          size="sm"
          className={cx(styles.action, styles.textAction)}
          onClick={onClickEdit}
        >
          {t('dashboard-scene.control-edit-actions.view', 'View')}
        </Button>
        <div className={styles.actionsDivider} />
        <DeleteActionButton
          title={t('dashboard-scene.variable-editable-element.remove-title', 'Remove variable')}
          text={t(
            'dashboard-scene.variable-editable-element.remove-text',
            'Are you sure you want to remove: {{name}}?',
            {
              name: variable.state.name,
            }
          )}
          yesText={t('dashboard-scene.variable-editable-element.remove-confirm', 'Remove')}
          tooltip={t('dashboard-scene.control-edit-actions.remove-tooltip', 'Remove')}
          onConfirm={onClickDelete}
        />
      </>
    );
  }

  return (
    <>
      <SettingsActionButton onClick={onClickEdit} />
      {hasQueryEditor && (
        <>
          <div className={styles.actionsDivider} />
          <Button
            fill="text"
            variant="secondary"
            size="sm"
            className={cx(styles.action, styles.textAction)}
            onClick={onClickEditQueryInternal}
          >
            {variable instanceof CustomVariable
              ? t('dashboard-scene.variable-edit-actions.edit-custom-values', 'Edit values')
              : t('dashboard-scene.variable-edit-actions.edit-query', 'Edit query')}
          </Button>
        </>
      )}
      <div className={styles.actionsDivider} />
      <DuplicateActionButton onClick={onClickDuplicate} />
      <DeleteActionButton
        title={t('dashboard-scene.variable-editable-element.delete-title', 'Delete variable')}
        text={t('dashboard-scene.variable-editable-element.delete-text', 'Are you sure you want to delete: {{name}}?', {
          name: variable.state.name,
        })}
        yesText={t('dashboard-scene.variable-editable-element.delete-confirm', 'Delete variable')}
        onConfirm={onClickDelete}
      />
    </>
  );
}
