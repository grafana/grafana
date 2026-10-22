import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents, reportInteraction } from '@grafana/runtime';
import { Alert, Button, Drawer, Field, Input, Stack } from '@grafana/ui';
import { useGetFolderQuery } from 'app/api/clients/folder/v1beta1';
import { type Job, type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { JobStatus } from 'app/features/provisioning/Job/JobStatus';
import { type StepStatusInfo } from 'app/features/provisioning/Wizard/types';

import { ProvisioningAlert } from '../../Shared/ProvisioningAlert';
import { useCommitMessageTemplate } from '../../hooks/useCommitMessageTemplate';
import { useCommitTarget } from '../../hooks/useCommitTarget';
import { type StatusInfo } from '../../types';
import { type ProvisionedDashboardFormData } from '../../types/form';
import { type CommitTemplateVars } from '../../utils/commitMessage';
import { getCurrentCommitUser } from '../../utils/currentUser';
import { getJobListRedirectUrl } from '../../utils/redirect';
import { getRequestRef } from '../../utils/workflow';
import { type MoveJobSpec, useBulkActionJob } from '../BulkActions/useBulkActionJob';
import { getResourceTargetPath, getTargetFolderPathInRepo, isResourceAlreadyInTarget } from '../BulkActions/utils';
import { ResourceEditFormSharedFields } from '../Shared/ResourceEditFormSharedFields';

export interface Props {
  dashboard: DashboardScene;
  defaultValues: ProvisionedDashboardFormData;
  readOnly: boolean;
  isNew?: boolean;
  canPushToConfiguredBranch: boolean;
  targetFolderUID?: string;
  repository?: RepositoryView;
  onDismiss: () => void;
}

export function MoveProvisionedDashboardForm({
  dashboard,
  defaultValues,
  readOnly,
  isNew,
  canPushToConfiguredBranch,
  targetFolderUID,
  repository,
  onDismiss,
}: Props) {
  const methods = useForm<ProvisionedDashboardFormData>({ defaultValues });
  const { editPanel: panelEditor } = dashboard.useState();

  const { handleSubmit, watch } = methods;
  const appEvents = getAppEvents();

  const ref = watch('ref') ?? '';

  const templateVars: CommitTemplateVars = {
    action: 'move',
    resourceKind: 'dashboard',
    resourceID: dashboard.state.meta.uid ?? dashboard.state.meta.k8s?.name ?? '',
    title: dashboard.state.title ?? '',
    ...getCurrentCommitUser(),
  };
  const { locked, message } = useCommitMessageTemplate({
    repository,
    vars: templateVars,
    comment: watch('comment') ?? '',
    isCommentDirty: Boolean(methods.formState.dirtyFields.comment),
    setComment: (value) => methods.setValue('comment', value, { shouldDirty: false }),
  });

  const { workflow, lockBranch, prTitle } = useCommitTarget({
    repository,
    vars: templateVars,
    ref,
    isRefDirty: Boolean(methods.formState.dirtyFields.ref),
    setRef: (value) => methods.setValue('ref', value, { shouldDirty: false }),
  });

  const { data: targetFolder } = useGetFolderQuery(targetFolderUID ? { name: targetFolderUID! } : skipToken);
  const targetFolderPath = getTargetFolderPathInRepo({ targetFolderUID, targetFolder, repoName: repository?.name });
  const targetPath = targetFolderPath ? getResourceTargetPath(defaultValues.path, targetFolderPath) : '';

  const { createBulkJob, isLoading } = useBulkActionJob();
  const [job, setJob] = useState<Job>();
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [jobError, setJobError] = useState<string | StatusInfo>();

  const navigate = useNavigate();

  // Helper function to show error messages
  const showError = (error?: unknown) => {
    const payload = [t('dashboard-scene.move-provisioned-dashboard-form.api-error', 'Failed to move dashboard'), error];

    appEvents.publish({
      type: AppEvents.alertError.name,
      payload,
    });
  };

  const handleSubmitForm = async ({ repo, path }: ProvisionedDashboardFormData) => {
    if (!repo || !path || !repository || !targetFolderPath) {
      showError();
      return;
    }

    if (isResourceAlreadyInTarget(path, targetFolderPath)) {
      showError(
        t(
          'dashboard-scene.move-provisioned-dashboard-form.already-in-folder',
          'Dashboard is already in the selected folder.'
        )
      );
      return;
    }

    reportInteraction('grafana_provisioning_dashboard_move_submitted', {
      workflow,
      repositoryName: repo,
      repositoryType: repository.type ?? 'unknown',
    });

    const jobSpec: MoveJobSpec = {
      action: 'move',
      message,
      move: { ref: getRequestRef(repository, ref), targetPath: targetFolderPath, paths: [path] },
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

  const handleJobStatusChange = useCallback(
    (statusInfo: StepStatusInfo) => {
      if (statusInfo.status === 'success') {
        dashboard.setState({ isDirty: false });
        panelEditor?.onDiscard();
        navigate(getJobListRedirectUrl({ workflow, urls: statusInfo.urls, repoType: repository?.type, prTitle }));
      }

      if (statusInfo.status === 'error' && statusInfo.error) {
        setJobError(statusInfo.error);
      }
    },
    [dashboard, panelEditor, navigate, workflow, repository?.type, prTitle]
  );

  return (
    <Drawer
      title={t('dashboard-scene.move-provisioned-dashboard-form.drawer-title', 'Move Provisioned Dashboard')}
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
                <Alert
                  title={t(
                    'dashboard-scene.move-provisioned-dashboard-form.title-this-repository-is-read-only',
                    'This repository is read only'
                  )}
                >
                  <Trans i18nKey="dashboard-scene.move-provisioned-dashboard-form.move-read-only-message">
                    This dashboard cannot be moved directly from Grafana because the repository is read-only. To move
                    this dashboard, please move the file in your Git repository.
                  </Trans>
                </Alert>
              )}

              <Field
                noMargin
                label={t('dashboard-scene.move-provisioned-dashboard-form.target-path-label', 'Target path')}
              >
                <Input readOnly value={targetPath} />
              </Field>

              <ResourceEditFormSharedFields
                resourceType="dashboard"
                isNew={isNew}
                readOnly={readOnly}
                canPushToConfiguredBranch={canPushToConfiguredBranch}
                repository={repository}
                lockComment={locked}
                commitMessage={message}
                lockBranch={lockBranch}
              />

              <Stack gap={2}>
                <Button variant="primary" type="submit" disabled={isLoading || readOnly}>
                  {isLoading
                    ? t('dashboard-scene.move-provisioned-dashboard-form.moving', 'Moving...')
                    : t('dashboard-scene.move-provisioned-dashboard-form.move-action', 'Move dashboard')}
                </Button>
                <Button variant="secondary" onClick={onDismiss} fill="outline">
                  <Trans i18nKey="dashboard-scene.move-provisioned-dashboard-form.cancel-action">Cancel</Trans>
                </Button>
              </Stack>
            </Stack>
          </form>
        </FormProvider>
      )}
    </Drawer>
  );
}
