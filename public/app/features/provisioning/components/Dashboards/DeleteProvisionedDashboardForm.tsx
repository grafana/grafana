import { useCallback, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Drawer, Stack } from '@grafana/ui';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { ProvisioningAlert } from '../../Shared/ProvisioningAlert';
import { useCommitMessageTemplate } from '../../hooks/useCommitMessageTemplate';
import { useCommitTarget } from '../../hooks/useCommitTarget';
import { type ProvisionedDashboardFormData } from '../../types/form';
import { type CommitTemplateVars } from '../../utils/commitMessage';
import { getCurrentCommitUser } from '../../utils/currentUser';
import { getJobListRedirectUrl } from '../../utils/redirect';
import { getRequestRef } from '../../utils/workflow';
import { type DeleteJobSpec, type SubmittedJob, useBulkActionJob } from '../BulkActions/useBulkActionJob';
import { RepoInvalidStateBanner } from '../Shared/RepoInvalidStateBanner';
import { ResourceEditFormSharedFields } from '../Shared/ResourceEditFormSharedFields';
import { type JobSuccess, ResourceJobStatus } from '../Shared/ResourceJobStatus';
import { getProvisionedRequestError } from '../utils/errors';

export interface Props {
  canPushToConfiguredBranch: boolean;
  dashboard: DashboardScene;
  defaultValues: ProvisionedDashboardFormData;
  readOnly: boolean;
  isNew?: boolean;
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
  readOnly,
  isNew,
  repository,
  onDismiss,
}: Props) {
  // State
  const [submitted, setSubmitted] = useState<SubmittedJob>();
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  // Hooks
  const navigate = useNavigate();
  const { editPanel: panelEditor } = dashboard.useState();
  const { createBulkJob, isLoading } = useBulkActionJob();
  // Form
  const methods = useForm<ProvisionedDashboardFormData>({ defaultValues });
  const { handleSubmit, watch } = methods;
  const ref = watch('ref') ?? '';

  const templateVars: CommitTemplateVars = {
    action: 'delete',
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

  const { workflow, isResolving, lockBranch, prTitle } = useCommitTarget({
    repository,
    vars: templateVars,
    ref,
    isRefDirty: Boolean(methods.formState.dirtyFields.ref),
    setRef: (value) => methods.setValue('ref', value, { shouldDirty: false }),
  });

  const showError = (error: unknown) => {
    setSubmitError(
      getProvisionedRequestError(
        error,
        t('dashboard-scene.delete-provisioned-dashboard-form.delete-error', 'Failed to delete dashboard')
      )
    );
  };

  const handleSubmitForm = async ({ repo }: ProvisionedDashboardFormData) => {
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
      repositoryType: repository.type ?? 'unknown',
    });

    const jobSpec: DeleteJobSpec = {
      action: 'delete',
      message,
      delete: {
        ref: getRequestRef(repository, ref),
        resources: [
          {
            name: dashboard.state.meta.uid ?? dashboard.state.meta.k8s?.name ?? '',
            group: 'dashboard.grafana.app',
            kind: 'Dashboard',
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
        setSubmitted({ job: result.job, workflow, prTitle });
      }
    } catch (error) {
      showError(error);
    }
  };

  const handleJobSuccess = useCallback(
    ({ urls }: JobSuccess) => {
      if (!submitted) {
        return;
      }
      // Nothing is left to save once the file is deleted, so the redirect must not trip the
      // unsaved-changes prompt.
      dashboard.setState({ isDirty: false });
      panelEditor?.onDiscard();
      navigate(
        getJobListRedirectUrl({
          workflow: submitted.workflow,
          urls,
          repoType: repository?.type,
          action: 'delete',
          prTitle: submitted.prTitle,
        })
      );
    },
    [dashboard, panelEditor, navigate, submitted, repository?.type]
  );

  return (
    <Drawer
      title={t('dashboard-scene.delete-provisioned-dashboard-form.drawer-title', 'Delete Provisioned Dashboard')}
      subtitle={dashboard.state.title}
      onClose={onDismiss}
    >
      {submitted ? (
        <ResourceJobStatus job={submitted.job} jobType="delete" onSuccess={handleJobSuccess} />
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
                lockComment={locked}
                commitMessage={message}
                lockBranch={lockBranch}
              />

              {submitError && <ProvisioningAlert error={submitError} />}

              <Stack gap={2}>
                <Button variant="destructive" type="submit" disabled={isLoading || isResolving || readOnly}>
                  {isLoading
                    ? t('dashboard-scene.delete-provisioned-dashboard-form.deleting', 'Deleting...')
                    : t('dashboard-scene.delete-provisioned-dashboard-form.delete-action', 'Delete dashboard')}
                </Button>
                <Button variant="secondary" onClick={onDismiss} fill="outline">
                  <Trans i18nKey="dashboard-scene.delete-provisioned-dashboard-form.cancel-action">Cancel</Trans>
                </Button>
              </Stack>
            </Stack>
          </form>
        </FormProvider>
      )}
    </Drawer>
  );
}
