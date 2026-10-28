import { skipToken } from '@reduxjs/toolkit/query';
import { FormProvider, useForm } from 'react-hook-form';

import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents, reportInteraction } from '@grafana/runtime';
import { Alert, Button, Drawer, Field, Input, Stack } from '@grafana/ui';
import { useGetFolderQuery } from 'app/api/clients/folder/v1beta1';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { extractErrorMessage } from 'app/api/utils';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { useCommitMessageTemplate } from '../../hooks/useCommitMessageTemplate';
import { useCommitTarget } from '../../hooks/useCommitTarget';
import { useResourceJob } from '../../hooks/useResourceJob';
import { type ProvisionedDashboardFormData } from '../../types/form';
import { type MoveJobSpec } from '../../types/job';
import { type CommitTemplateVars } from '../../utils/commitMessage';
import { getCurrentCommitUser } from '../../utils/currentUser';
import { getRequestRef } from '../../utils/workflow';
import { getResourceTargetPath, getTargetFolderPathInRepo, isResourceAlreadyInTarget } from '../BulkActions/utils';
import { ResourceEditFormSharedFields } from '../Shared/ResourceEditFormSharedFields';
import { ResourceJobStatus } from '../Shared/ResourceJobStatus';

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

  const { workflow, isResolving, lockBranch, prTitle } = useCommitTarget({
    repository,
    vars: templateVars,
    ref,
    isRefDirty: Boolean(methods.formState.dirtyFields.ref),
    setRef: (value) => methods.setValue('ref', value, { shouldDirty: false }),
  });

  const { data: targetFolder } = useGetFolderQuery(targetFolderUID ? { name: targetFolderUID! } : skipToken);
  const targetFolderPath = getTargetFolderPathInRepo({ targetFolderUID, targetFolder, repoName: repository?.name });
  const targetPath = targetFolderPath ? getResourceTargetPath(defaultValues.path, targetFolderPath) : '';

  const { submitted, submit, isCreating, handleSuccess } = useResourceJob({
    repository,
    prTitle,
    onBeforeLeave: () => {
      dashboard.setState({ isDirty: false });
      panelEditor?.onDiscard();
    },
  });

  // Helper function to show error messages
  const showError = (error?: string) => {
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
      move: {
        ref: getRequestRef(repository, ref),
        targetPath: targetFolderPath,
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
      await submit(jobSpec);
    } catch (error) {
      showError(
        extractErrorMessage(
          error,
          t('browse-dashboards.bulk-actions.error-generic', 'Unexpected error happened when creating job')
        )
      );
    }
  };

  return (
    <Drawer
      title={t('dashboard-scene.move-provisioned-dashboard-form.drawer-title', 'Move Provisioned Dashboard')}
      subtitle={dashboard.state.title}
      onClose={onDismiss}
    >
      {submitted ? (
        <ResourceJobStatus job={submitted.job} jobType="move" onSuccess={handleSuccess} />
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
                <Button variant="primary" type="submit" disabled={isCreating || isResolving || readOnly}>
                  {isCreating
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
