import { useCallback, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Stack } from '@grafana/ui';
import { Job } from 'app/api/clients/provisioning/v0alpha1';
import { contextSrv } from 'app/core/services/context_srv';

import { JobStatus } from '../../Job/JobStatus';
import { StepStatusInfo } from '../../Wizard/types';
import { useOrphanedResourceActions } from '../../hooks/useOrphanedResourceActions';

import { OrphanedResourceActionConfirmModal, OrphanedResourceModalAction } from './OrphanedResourceActionConfirmModal';

interface Props {
  repositoryName: string;
}

/**
 * Shared banner/alert for orphaned resources (dashboards or folders) whose
 * provisioning repository no longer exists. All users see the warning;
 * admins can release or delete all resources from the missing repository.
 */
export function OrphanedResourceBanner({ repositoryName }: Props) {
  const [pendingAction, setPendingAction] = useState<OrphanedResourceModalAction | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const isAdmin = contextSrv.hasRole('Admin') || contextSrv.isGrafanaAdmin;

  const { submitRelease, submitDelete, isSubmitting, clearError } = useOrphanedResourceActions({
    repositoryName,
  });

  const openConfirm = (nextAction: OrphanedResourceModalAction) => {
    clearError();
    setPendingAction(nextAction);
  };

  const handleRelease = useCallback(async () => {
    const j = await submitRelease();
    setJob(j);
    setPendingAction(null);
    return j;
  }, [submitRelease]);

  const handleDelete = useCallback(async () => {
    const j = await submitDelete();
    setJob(j);
    setPendingAction(null);
    return j;
  }, [submitDelete]);

  const handleJobStatusChange = useCallback((statusInfo: StepStatusInfo) => {
    if (statusInfo.status === 'success') {
      window.location.reload();
    }
  }, []);

  if (job) {
    return <JobStatus watch={job} jobType="delete" onStatusChange={handleJobStatusChange} />;
  }

  return (
    <>
      <Alert
        severity="warning"
        title={t(
          'provisioning.orphaned-resource-banner.title',
          'This resource is managed by a repository that no longer exists'
        )}
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
          <Trans i18nKey="provisioning.orphaned-resource-banner.message">
            The repository that managed this resource has been deleted. This resource cannot be saved or modified until
            it is released or removed. Releasing or deleting will affect all resources managed by that repository.
          </Trans>
          {!isAdmin && (
            <Trans i18nKey="provisioning.orphaned-resource-banner.contact-admin">
              Contact your Grafana administrator to release or delete all resources from the missing repository.
            </Trans>
          )}
        </Stack>
      </Alert>
      <OrphanedResourceActionConfirmModal
        action={pendingAction}
        isSubmitting={isSubmitting}
        onDismiss={() => setPendingAction(null)}
        submitRelease={handleRelease}
        submitDelete={handleDelete}
        onSuccess={() => setPendingAction(null)}
      />
    </>
  );
}
