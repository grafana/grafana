import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Stack } from '@grafana/ui';
import { Job } from 'app/api/clients/provisioning/v0alpha1';
import { contextSrv } from 'app/core/services/context_srv';

import { JobStatus } from '../../Job/JobStatus';
import { StepStatusInfo } from '../../Wizard/types';
import { useOrphanedResourceActions } from '../../hooks/useOrphanedResourceActions';

import { OrphanedResourceActionConfirmModal, OrphanedResourceAction } from './OrphanedResourceActionConfirmModal';

interface Props {
  repositoryName: string;
}

/**
 * Shared banner/alert for orphaned resources (dashboards or folders) whose
 * provisioning repository no longer exists. All users see the warning;
 * admins can release or delete all resources from the missing repository.
 */
export function OrphanedResourceBanner({ repositoryName }: Props) {
  const [actionType, setActionType] = useState<OrphanedResourceAction | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [jobResult, setJobResult] = useState<StepStatusInfo | null>(null);

  const navigate = useNavigate();

  const isAdmin = contextSrv.hasRole('Admin') || contextSrv.isGrafanaAdmin;

  const { submitRelease, submitDelete, isSubmitting, clearError } = useOrphanedResourceActions({
    repositoryName,
  });

  const openConfirm = (nextAction: OrphanedResourceAction) => {
    clearError();
    setActionType(nextAction);
  };

  const handleRelease = useCallback(async () => {
    const job = await submitRelease();
    setJob(job);
    return job;
  }, [submitRelease]);

  const handleDelete = useCallback(async () => {
    const job = await submitDelete();
    setJob(job);
    return job;
  }, [submitDelete]);

  const handleJobStatusChange = useCallback((statusInfo: StepStatusInfo) => {
    // store job result
    setJobResult(statusInfo);
  }, []);

  const handleSuccess = () => {
    navigate('/dashboards');
  };

  if (job && actionType) {
    return (
      <>
        <JobStatus watch={job} jobType={actionType} onStatusChange={handleJobStatusChange} />
        {jobResult?.status === 'success' && (
          <Alert
            severity="success"
            title={t('provisioning.orphaned-resource-banner.job-success', 'Orphaned resources processed successfully')}
            action={
              <Button onClick={handleSuccess}>
                <Trans i18nKey="provisioning.orphaned-resource-banner.success-back-to-dashboards">
                  Back to dashboards
                </Trans>
              </Button>
            }
          />
        )}
        {jobResult?.status === 'warning' && (
          <Alert
            severity="warning"
            title={t(
              'provisioning.orphaned-resource-banner.job-warning',
              'Some resources were processed with warnings. Please review the results.'
            )}
          />
        )}
        {jobResult?.status === 'error' && (
          <Alert
            severity="error"
            title={t(
              'provisioning.orphaned-resource-banner.job-error',
              'An error occurred while processing orphaned resources'
            )}
          />
        )}
      </>
    );
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
              <Button variant="secondary" disabled={isSubmitting} onClick={() => openConfirm('releaseResources')}>
                {t('provisioning.orphaned-resource-banner.release-button', 'Release')}
              </Button>
              <Button variant="destructive" disabled={isSubmitting} onClick={() => openConfirm('deleteResources')}>
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
        action={actionType}
        isSubmitting={isSubmitting}
        onDismiss={() => setActionType(null)}
        submitRelease={handleRelease}
        submitDelete={handleDelete}
      />
    </>
  );
}
