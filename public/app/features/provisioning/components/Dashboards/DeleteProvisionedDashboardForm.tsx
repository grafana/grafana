import { useCallback, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Drawer, Stack } from '@grafana/ui';
import {
  type Job,
  type RepositoryView,
  useDeleteRepositoryFilesWithPathMutation,
} from 'app/api/clients/provisioning/v0alpha1';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { JobStatus } from 'app/features/provisioning/Job/JobStatus';
import { type StepStatusInfo } from 'app/features/provisioning/Wizard/types';

import { ProvisioningAlert } from '../../Shared/ProvisioningAlert';
import { useProvisionedRequestHandler } from '../../hooks/useProvisionedRequestHandler';
import { type StatusInfo } from '../../types';
import { type ProvisionedDashboardFormData } from '../../types/form';
import { renderCommitMessage } from '../../utils/commitMessage';
import { buildResourceBranchRedirectUrl } from '../../utils/redirect';
import { useBulkActionJob } from '../BulkActions/useBulkActionJob';
import { RepoInvalidStateBanner } from '../Shared/RepoInvalidStateBanner';
import { ResourceEditFormSharedFields } from '../Shared/ResourceEditFormSharedFields';
import { getProvisionedRequestError } from '../utils/errors';

export interface Props {
  canPushToConfiguredBranch: boolean;
  dashboard: DashboardScene;
  defaultValues: ProvisionedDashboardFormData;
  readOnly: boolean;
  isNew?: boolean;
  loadedFromRef?: string;
  repository?: RepositoryView;
  onDismiss: () => void;
}

/**
 * @description
 * Drawer component for deleting a git provisioned dashboard.
 */
export function DeleteProvisionedDashboardForm({
  canPushToConfiguredBranch,
  dashboard,
  defaultValues,
  loadedFromRef,
  readOnly,
  isNew,
  repository,
  onDismiss,
}: Props) {
  // State
  const [job, setJob] = useState<Job>();
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [jobError, setJobError] = useState<string | StatusInfo>();
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  // Hooks
  const navigate = useNavigate();
  const { editPanel: panelEditor } = dashboard.useState();
  const { createBulkJob, isLoading } = useBulkActionJob();
  const [deleteRepoFile, request] = useDeleteRepositoryFilesWithPathMutation();
  // Form
  const methods = useForm<ProvisionedDashboardFormData>({ defaultValues });
  const { handleSubmit, watch } = methods;
  const [ref, workflow] = watch(['ref', 'workflow']);

  const showError = (error: unknown) => {
    setSubmitError(
      getProvisionedRequestError(
        error,
        'dashboard',
        t('dashboard-scene.delete-provisioned-dashboard-form.delete-error', 'Failed to delete dashboard')
      )
    );
  };

  const handleSubmitForm = async ({ repo, path, comment }: ProvisionedDashboardFormData) => {
    setSubmitError(undefined);
    if (!repo || !repository) {
      showError(
        t(
          'dashboard-scene.delete-provisioned-dashboard-form.no-repository-selected',
          'Missing required repository for deletion'
        )
      );
      return;
    }

    reportInteraction('grafana_provisioning_dashboard_delete_submitted', {
      workflow,
      repositoryName: repo,
      repositoryType: repository?.type ?? 'unknown',
    });

    // Branch workflow: use /files API for direct file operations
    if (workflow === 'branch') {
      const branchRef = ref;
      const commitMessage =
        comment ||
        renderCommitMessage(repository?.commit?.singleResourceMessageTemplate, {
          action: 'delete',
          resourceKind: 'dashboard',
          resourceID: dashboard.state.meta.uid ?? dashboard.state.meta.k8s?.name ?? '',
          title: dashboard.state.title ?? '',
        });

      try {
        await deleteRepoFile({
          name: repo,
          path,
          ref: branchRef,
          message: commitMessage,
        }).unwrap();
      } catch (error) {
        showError(error);
      }
      return;
    }

    // Write workflow: use Job API
    const effectiveRef = isNew ? undefined : loadedFromRef;
    const jobSpec = {
      action: 'delete' as const,
      delete: {
        ref: effectiveRef,
        resources: [
          {
            name: dashboard.state.meta.uid ?? dashboard.state.meta.k8s?.name ?? '',
            group: 'dashboard.grafana.app' as const,
            kind: 'Dashboard' as const,
          },
        ],
      },
    };

    try {
      const result = await createBulkJob(repository, jobSpec);
      if (!result.success) {
        showError(result.error);
        return;
      }

      if (result.job) {
        setJob(result.job);
        setHasSubmitted(true);
      }
    } catch (error) {
      showError(error);
    }
  };

  // Branch success handler for /files API — redirects to /dashboards (not the deleted dashboard's preview URL)
  const onBranchSuccess = (_path: string, info: { repoType: string }, urls?: Record<string, string>) => {
    panelEditor?.onDiscard();
    const url = buildResourceBranchRedirectUrl({
      paramName: 'new_pull_request_url',
      paramValue: urls?.newPullRequestURL,
      repoType: info.repoType,
      action: 'delete',
    });
    navigate(url);
  };

  const handleJobStatusChange = useCallback(
    (statusInfo: StepStatusInfo) => {
      if (statusInfo.status === 'success') {
        panelEditor?.onDiscard();
        navigate('/dashboards');
      }

      if (statusInfo.status === 'error' && statusInfo.error) {
        setJobError(statusInfo.error);
      }
    },
    [panelEditor, navigate]
  );

  useProvisionedRequestHandler({
    request,
    workflow,
    resourceType: 'dashboard',
    repository,
    selectedBranch: ref || loadedFromRef,
    successMessage: t(
      'dashboard-scene.delete-provisioned-dashboard-form.success-message',
      'Dashboard deleted successfully'
    ),
    handlers: {
      onDismiss,
      onBranchSuccess: ({ path, urls }, info) => onBranchSuccess(path, info, urls),
      onError: showError,
    },
  });

  return (
    <Drawer
      title={t('dashboard-scene.delete-provisioned-dashboard-form.drawer-title', 'Delete Provisioned Dashboard')}
      subtitle={dashboard.state.title}
      onClose={onDismiss}
    >
      {hasSubmitted && job ? (
        <>
          <ProvisioningAlert error={jobError} />
          <JobStatus watch={job} jobType="move" onStatusChange={handleJobStatusChange} />
        </>
      ) : (
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(handleSubmitForm)}>
            <Stack direction="column" gap={2}>
              {readOnly && (
                <RepoInvalidStateBanner
                  noRepository={false}
                  isReadOnlyRepo={true}
                  readOnlyMessage="To delete this dashboard, please remove the file from your repository."
                />
              )}

              <ResourceEditFormSharedFields
                resourceType="dashboard"
                isNew={isNew}
                readOnly={readOnly}
                canPushToConfiguredBranch={canPushToConfiguredBranch}
                repository={repository}
              />

              {submitError && <ProvisioningAlert error={submitError} />}

              <Stack gap={2}>
                <Button variant="secondary" onClick={onDismiss} fill="outline">
                  <Trans i18nKey="dashboard-scene.delete-provisioned-dashboard-form.cancel-action">Cancel</Trans>
                </Button>
                <Button variant="destructive" type="submit" disabled={isLoading || request.isLoading || readOnly}>
                  {isLoading || request.isLoading
                    ? t('dashboard-scene.delete-provisioned-dashboard-form.deleting', 'Deleting...')
                    : t('dashboard-scene.delete-provisioned-dashboard-form.delete-action', 'Delete dashboard')}
                </Button>
              </Stack>
            </Stack>
          </form>
        </FormProvider>
      )}
    </Drawer>
  );
}
