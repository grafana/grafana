import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Stack } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

import { useOrphanedResourceActions } from '../../hooks/useOrphanedResourceActions';

import { OrphanedResourceActionConfirmModal, OrphanedResourceModalAction } from './OrphanedResourceActionConfirmModal';

interface Props {
  uid: string;
  resourceType: 'dashboards' | 'folders';
  /** Shown inline on the page, outside drawers */
  variant?: 'banner' | 'alert';
}

/**
 * Shared banner/alert for orphaned resources (dashboards or folders) whose
 * provisioning repository no longer exists. All users see the warning;
 * admins can release or delete the resource (API wiring pending).
 */
export function OrphanedResourceBanner({ uid, resourceType, variant = 'banner' }: Props) {
  const [pendingAction, setPendingAction] = useState<OrphanedResourceModalAction | null>(null);
  const isAdmin = contextSrv.hasRole('Admin') || contextSrv.isGrafanaAdmin;

  const { submitRelease, submitDelete, isSubmitting, error, clearError } = useOrphanedResourceActions({
    uid,
    resourceType,
  });

  const resourceLabel = resourceType === 'dashboards' ? 'dashboard' : 'folder';

  const openConfirm = (nextAction: OrphanedResourceModalAction) => {
    clearError();
    setPendingAction(nextAction);
  };

  return (
    <>
      {error != null && (
        <Alert
          severity="error"
          title={t('provisioning.orphaned-resource-banner.action-error-title', 'Something went wrong')}
          onRemove={clearError}
        >
          {error instanceof Error ? error.message : String(error)}
        </Alert>
      )}
      <Alert
        severity="warning"
        title={t(
          'provisioning.orphaned-resource-banner.title',
          'This {{resourceLabel}} is linked to a repository that no longer exists',
          { resourceLabel }
        )}
        style={variant === 'banner' ? { flex: 0 } : undefined}
        action={
          isAdmin ? (
            <Stack direction="row" gap={1} alignItems="center">
              <Button variant="secondary" disabled={isSubmitting} onClick={() => openConfirm('release')}>
                {t('provisioning.orphaned-resource-banner.release-button', 'Release')}
              </Button>
              <Button variant="destructive" disabled={isSubmitting} onClick={() => openConfirm('delete')}>
                {t('provisioning.orphaned-resource-banner.delete-button', 'Delete')}
              </Button>
            </Stack>
          ) : undefined
        }
      >
        <Stack direction="column" gap={1}>
          {variant === 'banner' ? (
            <Trans i18nKey="provisioning.orphaned-resource-banner.message-banner">
              The provisioning repository that managed this resource has been removed. You can view this resource but
              cannot save or delete it until it is released from the missing repository or removed.
            </Trans>
          ) : (
            <Trans i18nKey="provisioning.orphaned-resource-banner.message-alert">
              The provisioning repository that managed this resource has been removed. This resource cannot be saved or
              deleted through the normal provisioning workflow until it is released or removed.
            </Trans>
          )}
          {isAdmin ? (
            <Trans i18nKey="provisioning.orphaned-resource-banner.admin-actions-hint" values={{ resourceLabel }}>
              As an administrator, use Release to convert this {{resourceLabel}} into a regular {{resourceLabel}} you can
              edit and save, or Delete to remove it permanently.
            </Trans>
          ) : (
            <Trans i18nKey="provisioning.orphaned-resource-banner.contact-admin">
              Contact your Grafana administrator to release or delete this resource.
            </Trans>
          )}
        </Stack>
      </Alert>
      <OrphanedResourceActionConfirmModal
        action={pendingAction}
        resourceLabel={resourceLabel}
        isSubmitting={isSubmitting}
        onDismiss={() => setPendingAction(null)}
        submitRelease={submitRelease}
        submitDelete={submitDelete}
        onSuccess={() => setPendingAction(null)}
      />
    </>
  );
}
