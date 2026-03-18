import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Alert, Button, ConfirmModal, Stack } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

import { useDisconnectOrphanedResource } from '../../hooks/useDisconnectOrphanedResource';

interface Props {
  uid: string;
  resourceType: 'dashboards' | 'folders';
  /** Shown inline on the page, outside drawers */
  variant?: 'banner' | 'alert';
}

/**
 * Shared banner/alert for orphaned resources (dashboards or folders) whose
 * provisioning repository no longer exists. All users see the warning;
 * only admins get the "Disconnect" action.
 */
export function OrphanedResourceBanner({ uid, resourceType, variant = 'banner' }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const isAdmin = contextSrv.hasRole('Admin') || contextSrv.isGrafanaAdmin;

  const { disconnect, isDisconnecting } = useDisconnectOrphanedResource({
    uid,
    resourceType,
  });

  const handleConfirm = async () => {
    await disconnect();
    window.location.reload();
  };

  const resourceLabel = resourceType === 'dashboards' ? 'dashboard' : 'folder';

  return (
    <>
      <Alert
        severity="warning"
        title={t(
          'provisioning.orphaned-resource-banner.title',
          'This {{resourceLabel}} is linked to a repository that no longer exists',
          { resourceLabel }
        )}
        style={variant === 'banner' ? { flex: 0 } : undefined}
      >
        <Stack direction="column" gap={1}>
          {variant === 'banner' ? (
            <Trans i18nKey="provisioning.orphaned-resource-banner.message-banner">
              The provisioning repository that managed this resource has been removed. You can view this resource but
              cannot save or delete it until it is disconnected from the missing repository.
            </Trans>
          ) : (
            <Trans i18nKey="provisioning.orphaned-resource-banner.message-alert">
              The provisioning repository that managed this resource has been removed. This resource cannot be saved or
              deleted through the normal provisioning workflow until it is disconnected.
            </Trans>
          )}
          {isAdmin && (
            <div>
              <Button
                variant="secondary"
                size="sm"
                icon={isDisconnecting ? 'spinner' : undefined}
                disabled={isDisconnecting}
                onClick={() => setShowConfirm(true)}
              >
                {t('provisioning.orphaned-resource-banner.disconnect-button', 'Disconnect from repository')}
              </Button>
            </div>
          )}
        </Stack>
      </Alert>
      <ConfirmModal
        isOpen={showConfirm}
        title={t('provisioning.orphaned-resource-banner.confirm-title', 'Disconnect from repository?')}
        body={t(
          'provisioning.orphaned-resource-banner.confirm-body',
          'This will remove all provisioning annotations from this {{resourceLabel}}, converting it to a regular {{resourceLabel}} that can be saved and deleted normally. This action cannot be undone.',
          { resourceLabel }
        )}
        confirmText={t('provisioning.orphaned-resource-banner.confirm-button', 'Disconnect')}
        onConfirm={handleConfirm}
        onDismiss={() => setShowConfirm(false)}
      />
    </>
  );
}
