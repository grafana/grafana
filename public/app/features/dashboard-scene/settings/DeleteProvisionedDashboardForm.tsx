import { useForm, FormProvider } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Button, Drawer, Stack } from '@grafana/ui';
import { RepositoryView, useDeleteRepositoryFilesWithPathMutation } from 'app/api/clients/provisioning/v0alpha1';
import { RepoInvalidStateBanner } from 'app/features/browse-dashboards/components/BulkActions/RepoInvalidStateBanner';
import { PROVISIONING_URL } from 'app/features/provisioning/constants';

import { ResourceEditFormSharedFields } from '../components/Provisioned/ResourceEditFormSharedFields';
import { ProvisionedDashboardFormData } from '../saving/shared';
import { DashboardScene } from '../scene/DashboardScene';
import { useProvisionedRequestHandler, ProvisionedOperationInfo } from '../utils/useProvisionedRequestHandler';

import { buildResourceBranchRedirectUrl } from './utils';

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

  const [ref, workflow] = watch(['ref', 'workflow']);
  const [deleteRepoFile, request] = useDeleteRepositoryFilesWithPathMutation();

  const handleSubmitForm = async ({ repo, path, comment }: ProvisionedDashboardFormData) => {
    if (!repo || !path) {
      console.error('Missing required fields for deletion:', { repo, path });
      return;
    }

    // If writing to the original branch, use the loaded reference; otherwise, use the selected ref.
    const branchRef = workflow === 'write' ? loadedFromRef : ref;
    const commitMessage = comment || `Delete dashboard: ${dashboard.state.title}`;

    deleteRepoFile({
      name: repo,
      path: path,
      ref: branchRef,
      message: commitMessage,
    });
  };

  const navigate = useNavigate();

  const onError = (error: unknown) => {
    getAppEvents().publish({
      type: AppEvents.alertError.name,
      payload: [t('dashboard-scene.delete-provisioned-dashboard-form.api-error', 'Failed to delete dashboard'), error],
    });
  };

  const onWriteSuccess = () => {
    dashboard.setState({ isDirty: false });
    panelEditor?.onDiscard();
    // TODO reset search state instead
    window.location.href = '/dashboards';
  };

  const onBranchSuccess = (path: string, info: ProvisionedOperationInfo, urls?: Record<string, string>) => {
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
      onWriteSuccess,
      onError,
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

            {/* Save / Cancel button */}
            <Stack gap={2}>
              <Button variant="destructive" type="submit" disabled={request.isLoading || readOnly}>
                {request.isLoading
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
    </Drawer>
  );
}
