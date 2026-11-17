import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { DeleteActionButton, DuplicateActionButton, getActionStyles, SettingsActionButton } from './EditActions';

export function PromptEditActions({
  name,
  onClickEdit,
  onClickDuplicate,
  onClickDelete,
}: {
  name: string;
  onClickEdit: () => void;
  onClickDuplicate: () => void;
  onClickDelete: () => void;
}) {
  const styles = useStyles2(getActionStyles);

  return (
    <>
      <SettingsActionButton
        onClick={onClickEdit}
        tooltip={t('dashboard-scene.prompt-edit-actions.tooltip-prompt-settings', 'Prompt settings')}
      />
      <div className={styles.actionsDivider} />
      <DuplicateActionButton onClick={onClickDuplicate} />
      <DeleteActionButton
        title={t('dashboard-scene.prompt-edit.delete-title', 'Delete prompt')}
        text={t('dashboard-scene.prompt-edit.delete-text', 'Are you sure you want to delete: {{name}}?', { name })}
        yesText={t('dashboard-scene.prompt-edit.delete-confirm', 'Delete prompt')}
        onConfirm={onClickDelete}
      />
    </>
  );
}
