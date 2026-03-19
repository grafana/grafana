import { t } from '@grafana/i18n';
import { ButtonVariant, ConfirmModal } from '@grafana/ui';

export type OrphanedResourceModalAction = 'release' | 'delete';

interface Props {
  action: OrphanedResourceModalAction | null;
  resourceLabel: string;
  isSubmitting: boolean;
  onDismiss: () => void;
  submitRelease: () => Promise<unknown>;
  submitDelete: () => Promise<unknown>;
  /** Called after a successful submit so the parent can clear `action`. */
  onSuccess: () => void;
}

function getModalConfig(action: OrphanedResourceModalAction, resourceLabel: string) {
  if (action === 'release') {
    return {
      title: t('provisioning.orphaned-resource-banner.confirm-release-title', 'Release from provisioning?'),
      body: t(
        'provisioning.orphaned-resource-banner.confirm-release-body',
        'This will remove all provisioning annotations from this {{resourceLabel}}, converting it to a regular {{resourceLabel}} that can be saved and deleted normally.',
        { resourceLabel }
      ),
      confirmText: t('provisioning.orphaned-resource-banner.confirm-release-button', 'Release'),
      confirmButtonVariant: 'primary' as ButtonVariant,
    };
  }

  return {
    title: t(
      'provisioning.orphaned-resource-banner.confirm-delete-title',
      'Delete this {{resourceLabel}}?',
      { resourceLabel }
    ),
    body: t(
      'provisioning.orphaned-resource-banner.confirm-delete-body',
      'This will permanently delete this {{resourceLabel}}. This action cannot be undone.',
      { resourceLabel }
    ),
    confirmText: t('provisioning.orphaned-resource-banner.confirm-delete-button', 'Delete'),
    confirmButtonVariant: 'destructive' as ButtonVariant,
  };
}

export function OrphanedResourceActionConfirmModal({
  action,
  resourceLabel,
  isSubmitting,
  onDismiss,
  submitRelease,
  submitDelete,
  onSuccess,
}: Props) {
  if (action === null) {
    return null;
  }

  const { title, body, confirmText, confirmButtonVariant } = getModalConfig(action, resourceLabel);

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
      confirmButtonVariant={confirmButtonVariant}
      onConfirm={handleConfirm}
      onDismiss={onDismiss}
      disabled={isSubmitting}
    />
  );
}
