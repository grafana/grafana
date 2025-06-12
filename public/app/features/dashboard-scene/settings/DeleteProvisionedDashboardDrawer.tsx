import { useForm, FormProvider } from 'react-hook-form';

import { AppEvents } from '@grafana/data';
import { Trans, useTranslate } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Button, Drawer, Stack } from '@grafana/ui';
import { useDeleteRepositoryFiles } from 'app/features/provisioning/hooks/useDeleteRepositoryFiles';

import { CommentField } from '../components/Provisioned/CommentField';
import { PathField } from '../components/Provisioned/PathField';
import { WorkflowFields } from '../components/Provisioned/WorkflowFields';
import { ProvisionedDashboardData } from '../saving/provisioned/hooks';
import { ProvisionedDashboardFormData } from '../saving/shared';
import { DashboardScene } from '../scene/DashboardScene';

interface Props {
  dashboard: DashboardScene;
  provisionedDashboardData: ProvisionedDashboardData;
  onDismiss: () => void;
}

/**
 * @description
 * Drawer component for deleting a git provisioned dashboard.
 */
export function DeleteProvisionedDashboardDrawer({ dashboard, provisionedDashboardData, onDismiss }: Props) {
  const { t } = useTranslate();

  const { defaultValues, repository, loadedFromRef, readOnly, isGitHub, workflowOptions } = provisionedDashboardData;
  if (!defaultValues) {
    return null;
  }

  const methods = useForm<ProvisionedDashboardFormData>({ defaultValues });
  const { handleSubmit, watch, reset } = methods;

  const [ref, workflow, path] = watch(['ref', 'workflow', 'path']);
  const [deleteRepoFile, request] = useDeleteRepositoryFiles();

  const handleSubmitForm = async (data: ProvisionedDashboardFormData) => {
    try {
      // Extract required values for deletion
      const repositoryName = data.repo || repository?.name;
      const filePath = path;
      if (!repositoryName || !filePath) {
        console.error('Missing required fields for deletion:', { repositoryName, filePath });
        return;
      }

      const branchRef = workflow === 'write' ? loadedFromRef : ref; // If user is writing to the original branch, override ref with whatever we loaded from
      const commitMessage = data.comment || `Delete dashboard: ${dashboard.state.title}`;

      // Call delete API
      await deleteRepoFile({
        name: repositoryName,
        path: path,
        ref: branchRef,
        message: commitMessage,
      });

      // Show success message
      getAppEvents().publish({
        type: AppEvents.alertSuccess.name,
        payload: [t('dashboard-scene.delete-provisioned-dashboard-form.success', 'Dashboard deleted successfully')],
      });

      if (workflow === 'branch') {
        // Reset form and close drawer
        onDismiss();
        reset();
        // TODO: this is a temporary solution to navigate back to the dashboard view, add a proper solution later
        // add maybe navigate back to dashboard with pull request option etc.
        window.history.back();
        return;
      }
    } catch (error) {
      console.error('Error deleting dashboard:', error);
      getAppEvents().publish({
        type: AppEvents.alertError.name,
        payload: [t('dashboard-scene.delete-provisioned-dashboard-form.error', 'Failed to push delete changes'), error],
      });
    }
  };

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
