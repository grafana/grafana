import { t } from '@grafana/i18n';
import { ConfirmModal } from '@grafana/ui';

import { type JobType } from '../../types';

export type OrphanedResourceAction = Extract<JobType, 'releaseResources' | 'deleteResources'>;

interface Props {
  action: OrphanedResourceAction | null;
  isSubmitting: boolean;
  onDismiss: () => void;
  submitRelease: () => Promise<unknown>;
  submitDelete: () => Promise<unknown>;
}

function getModalConfig(action: OrphanedResourceAction) {
  if (action === 'releaseResources') {
    return {
      title: t(
        'provisioning.orphaned-resource-banner.confirm-release-title',
        'Convert all resources to local from this repository?'
      ),
      body: t(
        'provisioning.orphaned-resource-banner.confirm-release-body',
        'This will remove provisioning annotations from all dashboards and folders managed by the missing repository, converting them to regular resources that can be saved and deleted normally.'
      ),
      confirmText: t('provisioning.orphaned-resource-banner.confirm-release-button', 'Convert to local'),
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
}: Props) {
  if (action === null) {
    return null;
  }

  const { title, body, confirmText } = getModalConfig(action);

  const handleConfirm = async () => {
    if (action === 'releaseResources') {
      await submitRelease();
    } else {
      await submitDelete();
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
