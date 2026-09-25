import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { DeleteActionButton, DuplicateActionButton, getActionStyles, SettingsActionButton } from './EditActions';

export function LinkEditActions({
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
      <SettingsActionButton onClick={onClickEdit} />
      <div className={styles.actionsDivider} />
      <DuplicateActionButton onClick={onClickDuplicate} />
      <DeleteActionButton
        title={t('dashboard-scene.link-editable-element.delete-title', 'Delete link')}
        text={t('dashboard-scene.link-editable-element.delete-text', 'Are you sure you want to delete: {{name}}?', {
          name,
        })}
        yesText={t('dashboard-scene.link-editable-element.delete-confirm', 'Delete link')}
        onConfirm={onClickDelete}
      />
    </>
  );
}
