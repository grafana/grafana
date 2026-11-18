import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { DeleteActionButton, DuplicateActionButton, getActionStyles, SettingsActionButton } from './EditActions';

export function QuestionEditActions({
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
        tooltip={t('dashboard-scene.question-edit-actions.tooltip-question-settings', 'Question settings')}
      />
      <div className={styles.actionsDivider} />
      <DuplicateActionButton onClick={onClickDuplicate} />
      <DeleteActionButton
        title={t('dashboard-scene.question-edit.delete-title', 'Delete question')}
        text={t('dashboard-scene.question-edit.delete-text', 'Are you sure you want to delete: {{name}}?', { name })}
        yesText={t('dashboard-scene.question-edit.delete-confirm', 'Delete question')}
        onConfirm={onClickDelete}
      />
    </>
  );
}
