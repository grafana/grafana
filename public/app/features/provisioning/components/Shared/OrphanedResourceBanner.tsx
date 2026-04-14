import { useCallback, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Stack } from '@grafana/ui';
import { type Job } from 'app/api/clients/provisioning/v0alpha1';
import { contextSrv } from 'app/core/services/context_srv';

import { JobStatus } from '../../Job/JobStatus';
import { type StepStatusInfo } from '../../Wizard/types';
import { useOrphanedResourceActions } from '../../hooks/useOrphanedResourceActions';
import { getJobResultAlertByStatus } from '../utils/orphanedResource';

import { OrphanedResourceActionConfirmModal, type OrphanedResourceAction } from './OrphanedResourceActionConfirmModal';

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

  const isAdmin = contextSrv.hasRole('Admin') || contextSrv.isGrafanaAdmin;
  const hideJobStatus = jobResult?.status === 'success';
  const result = jobResult ? getJobResultAlertByStatus()[jobResult.status] : undefined;

  const { submitRelease, submitDelete, isSubmitting, error, clearError } = useOrphanedResourceActions({
    repositoryName,
  });

  const openConfirm = (nextAction: OrphanedResourceAction) => {
    clearError();
    setActionType(nextAction);
  };

  const handleRelease = useCallback(async () => {
    const result = await submitRelease();
    if (result) {
      setJob(result);
    }
  }, [submitRelease]);

  const handleDelete = useCallback(async () => {
    const result = await submitDelete();
    if (result) {
      setJob(result);
    }
  }, [submitDelete]);

  const handleJobStatusChange = useCallback((statusInfo: StepStatusInfo) => {
    // store job result
    setJobResult(statusInfo);
  }, []);

  if (job && actionType) {
    // TODO: add action to dismiss result and navigate away or refresh page if needed
    return (
      <>
        {!hideJobStatus && <JobStatus watch={job} jobType={actionType} onStatusChange={handleJobStatusChange} />}
        {result && <Alert severity={result.severity} title={result.title} />}
      </>
    );
  }

  return (
    <>
      {error && !job && (
        <Alert
          severity="error"
          title={t('provisioning.orphaned-resource-banner.submit-error', 'Failed to create job for orphaned resources')}
        />
      )}
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
                {t('provisioning.orphaned-resource-banner.convert-to-local-button', 'Convert to local')}
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
            This resource cannot be saved or modified until it is converted to local. Converting to local or deleting it
            will affect all resources managed by that repository.
          </Trans>
          {!isAdmin && (
            <Trans i18nKey="provisioning.orphaned-resource-banner.contact-admin">
              Contact your Grafana administrator to convert this resource to local or delete all resources from the
              missing repository.
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
