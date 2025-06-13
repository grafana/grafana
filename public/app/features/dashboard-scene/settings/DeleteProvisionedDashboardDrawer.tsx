import { useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';

import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Button, Drawer, Stack } from '@grafana/ui';
import { useDeleteRepositoryFiles } from 'app/features/provisioning/hooks/useDeleteRepositoryFiles';

import { CommentField } from '../components/Provisioned/CommentField';
import { PathField } from '../components/Provisioned/PathField';
import { WorkflowFields } from '../components/Provisioned/WorkflowFields';
import { useProvisionedDashboardData } from '../saving/provisioned/hooks';
import { ProvisionedDashboardFormData } from '../saving/shared';
import { DashboardScene } from '../scene/DashboardScene';

export interface Props {
  dashboard: DashboardScene;
  onDismiss: () => void;
}

/**
 * @description
 * Drawer component for deleting a git provisioned dashboard.
 */
export function DeleteProvisionedDashboardDrawer({ dashboard, onDismiss }: Props) {
  const { defaultValues, loadedFromRef, readOnly, isGitHub, workflowOptions } = useProvisionedDashboardData(dashboard);
  if (!defaultValues) {
    return null;
  }

  const methods = useForm<ProvisionedDashboardFormData>({ defaultValues });
  const { handleSubmit, watch, reset } = methods;

  const [ref, workflow, path] = watch(['ref', 'workflow', 'path']);
  const [deleteRepoFile, request] = useDeleteRepositoryFiles();

  const handleSubmitForm = async ({ repo, path, comment }: ProvisionedDashboardFormData) => {
    if (!repo || !path) {
      console.error('Missing required fields for deletion:', { repo, path });
      return;
    }

    const branchRef = workflow === 'write' ? loadedFromRef : ref; // If user is writing to the original branch, override ref with whatever we loaded from
    const commitMessage = comment || `Delete dashboard: ${dashboard.state.title}`;

    // Call delete API
    deleteRepoFile({
      name: repo,
      path: path,
      ref: branchRef,
      message: commitMessage,
    });
  };

  useEffect(() => {
    // This effect runs when the delete file request state changes
    // it checks if the request was successful or if there was an error
    if (request.isSuccess) {
      // Show success message
      getAppEvents().publish({
        type: AppEvents.alertSuccess.name,
        payload: [t('dashboard-scene.delete-provisioned-dashboard-form.success', 'Dashboard deleted successfully')],
      });

      // Reset form and close drawer
      reset();
      onDismiss();
      // TODO: this is a temporary solution to navigate back to the dashboard view, add a proper solution later
      // add maybe navigate back to dashboard with pull request option etc.
      // window.history.back();
    } else if (request.isError) {
      getAppEvents().publish({
        type: AppEvents.alertError.name,
        payload: [
          t('dashboard-scene.delete-provisioned-dashboard-form.api-error', 'Error saving delete dashboard changes'),
          request.error,
        ],
      });
    }
  }, [request, onDismiss, reset]);

  return (
    <Drawer
      title={t('dashboard-scene.delete-provisioned-dashboard-form.drawer-title', 'Delete Provisioned Dashboard')}
      subtitle={dashboard.state.title}
      onClose={onDismiss}
    >
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(handleSubmitForm)}>
          <Stack direction="column" gap={2}>
            {/* file path in git */}
            <PathField readOnly={readOnly} />

            {/* Changes comment */}
            <CommentField disabled={readOnly} />

            {/* GitHub workflow fields */}
            {isGitHub && !readOnly && <WorkflowFields workflow={workflow} workflowOptions={workflowOptions} />}

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
