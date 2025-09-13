import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Button, Drawer, Stack } from '@grafana/ui';
import { RepositoryView, useDeleteRepositoryFilesWithPathMutation } from 'app/api/clients/provisioning/v0alpha1';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { PROVISIONING_URL } from 'app/features/provisioning/constants';

import { useProvisionedRequestHandler } from '../../hooks/useProvisionedRequestHandler';
import { ProvisionedDashboardFormData } from '../../types/form';
import { buildResourceBranchRedirectUrl } from '../../utils/redirect';
import { useBulkActionJob } from '../BulkActions/useBulkActionJob';
import { RepoInvalidStateBanner } from '../Shared/RepoInvalidStateBanner';
import { ResourceEditFormSharedFields } from '../Shared/ResourceEditFormSharedFields';

export interface Props {
  dashboard: DashboardScene;
  defaultValues: ProvisionedDashboardFormData;
  readOnly: boolean;
  isNew?: boolean;
  workflowOptions: Array<{ label: string; value: string }>;
  loadedFromRef?: string;
  repository?: RepositoryView;
  onDismiss: () => void;
}

/**
 * @description
 * Drawer component for deleting a git provisioned dashboard.
 */
export function DeleteProvisionedDashboardForm({
  dashboard,
  defaultValues,
  loadedFromRef,
  readOnly,
  isNew,
  workflowOptions,
  repository,
  onDismiss,
}: Props) {
  const methods = useForm<ProvisionedDashboardFormData>({ defaultValues });
  const { editPanel: panelEditor } = dashboard.useState();
  const { handleSubmit, watch } = methods;
  const navigate = useNavigate();

  const [ref, workflow] = watch(['ref', 'workflow']);
  const { createBulkJob, isLoading } = useBulkActionJob();
  const [deleteRepoFile, request] = useDeleteRepositoryFilesWithPathMutation();

  // Helper function to show error messages
  const showError = (error?: unknown) => {
    const payload = [
      t('dashboard-scene.delete-provisioned-dashboard-form.api-error', 'Failed to delete dashboard'),
      error,
    ];

    getAppEvents().publish({
      type: AppEvents.alertError.name,
      payload,
    });
  };

  const handleSubmitForm = async ({ repo, path, comment }: ProvisionedDashboardFormData) => {
    if (!repo || !repository) {
      console.error('Missing required repository for deletion:', { repo });
      return;
    }

    // Branch workflow: use /files API for direct file operations
    if (workflow === 'branch') {
      const branchRef = ref;
      const commitMessage = comment || `Delete dashboard: ${dashboard.state.title}`;

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

      getAppEvents().publish({
        type: AppEvents.alertSuccess.name,
        payload: [
          t(
            'dashboard-scene.delete-provisioned-dashboard-form.queued',
            'Delete queued. Changes will be applied shortly.'
          ),
        ],
      });
      onDismiss();
    } catch (error) {
      showError(error);
    }
  };

  // Branch success handler for /files API
  const onBranchSuccess = (path: string, info: { repoType: string }, urls?: Record<string, string>) => {
    panelEditor?.onDiscard();
    const url = buildResourceBranchRedirectUrl({
      baseUrl: `${PROVISIONING_URL}/${defaultValues.repo}/dashboard/preview/${path}`,
      paramName: 'pull_request_url',
      paramValue: urls?.newPullRequestURL,
      repoType: info.repoType,
    });
    navigate(url);
  };

  useProvisionedRequestHandler({
    request,
    workflow,
    resourceType: 'dashboard',
    successMessage: t(
      'dashboard-scene.delete-provisioned-dashboard-form.success-message',
      'Dashboard deleted successfully'
    ),
    handlers: {
      onDismiss,
      onBranchSuccess: ({ path, urls }, info) => onBranchSuccess(path, info, urls),
      onWriteSuccess: () => {}, // Not used since write workflow handles success directly
      onError: showError,
    },
  });

  return (
    <Drawer
      title={t('dashboard-scene.delete-provisioned-dashboard-form.drawer-title', 'Delete Provisioned Dashboard')}
      subtitle={dashboard.state.title}
      onClose={onDismiss}
    >
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
              workflow={workflow}
              workflowOptions={workflowOptions}
              repository={repository}
            />

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
    </Drawer>
  );
}
