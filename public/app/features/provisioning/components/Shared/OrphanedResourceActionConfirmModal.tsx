import { t } from '@grafana/i18n';
import { ConfirmModal } from '@grafana/ui';

export type OrphanedResourceModalAction = 'release' | 'delete';

interface Props {
  action: OrphanedResourceModalAction | null;
  isSubmitting: boolean;
  onDismiss: () => void;
  submitRelease: () => Promise<unknown>;
  submitDelete: () => Promise<unknown>;
  onSuccess: () => void;
}

function getModalConfig(action: OrphanedResourceModalAction) {
  if (action === 'release') {
    return {
      title: t(
        'provisioning.orphaned-resource-banner.confirm-release-title',
        'Release all resources from this repository?'
      ),
      body: t(
        'provisioning.orphaned-resource-banner.confirm-release-body',
        'This will remove provisioning annotations from all dashboards and folders managed by the missing repository, converting them to regular resources that can be saved and deleted normally.'
      ),
      confirmText: t('provisioning.orphaned-resource-banner.confirm-release-button', 'Release'),
    };
  }

  return {
    title: t(
      'provisioning.orphaned-resource-banner.confirm-delete-title',
      'Delete all resources from this repository?'
    ),
    body: t(
      'provisioning.orphaned-resource-banner.confirm-delete-body',
      'This will permanently delete all dashboards and folders managed by the missing repository. This action cannot be undone.'
    ),
    confirmText: t('provisioning.orphaned-resource-banner.confirm-delete-button', 'Delete'),
  };
}

export function OrphanedResourceActionConfirmModal({
  action,
  isSubmitting,
  onDismiss,
  submitRelease,
  submitDelete,
  onSuccess,
}: Props) {
  if (action === null) {
    return null;
  }

  const { title, body, confirmText } = getModalConfig(action);

  const handleConfirm = async () => {
    try {
      if (action === 'release') {
        await submitRelease();
      } else {
        await submitDelete();
      }
      onSuccess();
    } catch {
      // Caller (hook) stores error; banner shows inline alert.
    }
  };

  return (
    <ConfirmModal
      isOpen
      title={title}
      body={body}
      confirmText={confirmText}
      onConfirm={handleConfirm}
      onDismiss={onDismiss}
      disabled={isSubmitting}
    />
  );
}
