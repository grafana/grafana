import { t } from '@grafana/i18n';
import { ConfirmModal } from '@grafana/ui';

interface Props {
  title: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

/**
 * The delete confirmation, shared by the list's row menu and the notebook page toolbar so the two
 * cannot ask the question differently.
 *
 * Rendered by whatever owns the "which notebook" state rather than by the menu item itself: on the
 * list that menu lives inside a Dropdown overlay, which unmounts as the menu closes and would take
 * the modal with it.
 */
export function DeleteNotebookModal({ title, isDeleting, onConfirm, onDismiss }: Props) {
  return (
    <ConfirmModal
      isOpen
      title={t('notebooks.delete.title', 'Delete')}
      body={t('notebooks.delete.body', 'Are you sure you want to delete "{{title}}"?', { title })}
      confirmText={
        isDeleting ? t('notebooks.delete.in-progress', 'Deleting...') : t('notebooks.delete.confirm', 'Delete')
      }
      disabled={isDeleting}
      onConfirm={onConfirm}
      onDismiss={onDismiss}
    />
  );
}
