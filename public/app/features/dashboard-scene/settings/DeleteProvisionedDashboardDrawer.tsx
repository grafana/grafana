import { useForm, FormProvider } from 'react-hook-form';

import { AppEvents } from '@grafana/data';
import { Trans, useTranslate } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Button, Drawer, Stack } from '@grafana/ui';
import { useDeleteRepositoryFiles } from 'app/features/provisioning/hooks/useDeleteRepositoryFiles';

import { CommentField } from '../components/Provisioned/CommentField';
import { PathField } from '../components/Provisioned/PathField';
import { WorkflowFields } from '../components/Provisioned/WorkflowFields';
import { DashboardScene } from '../scene/DashboardScene';
import { ProvisionedDashboardData, ProvisionedDashboardFormData } from '../utils/useProvisionedDashboardData';

interface Props {
  dashboard: DashboardScene;
  provisionedDashboardData: ProvisionedDashboardData;
  onDismiss: () => void;
}

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
      const branchRef = workflow === 'write' ? loadedFromRef : ref; // If user is writing to the original branch, override ref with whatever we loaded from
      const commitMessage = data.comment || `Delete dashboard: ${dashboard.state.title}`;

      console.log('branchRef', branchRef, ref);

      if (!repositoryName || !filePath) {
        console.error('Missing required fields for deletion:', { repositoryName, filePath });
        return;
      }

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
        payload: ['Dashboard deleted successfully'],
      });

      // Reset form and close drawer
      onDismiss();
      reset();
      dashboard.onDashboardDelete();
    } catch (error) {
      console.error('Error deleting dashboard:', error);
      getAppEvents().publish({
        type: AppEvents.alertError.name,
        payload: ['Failed to delete dashboard', error],
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
            <PathField readOnly={readOnly} />
            <CommentField disabled={readOnly} />
            {/* GitHub workflow fields */}
            {isGitHub && !readOnly && <WorkflowFields workflow={workflow} workflowOptions={workflowOptions} />}

            {/* Save / Cancel button */}
            <Stack gap={2}>
              <Button variant="destructive" type="submit" disabled={request.isLoading || readOnly}>
                {request.isLoading
                  ? t('dashboard-scene.delete-provisioned-dashboard-form.deleting', 'Deleting...')
                  : t('dashboard-scene.delete-provisioned-dashboard-form.delete', 'Delete dashboard')}
              </Button>
              <Button variant="secondary" onClick={onDismiss} fill="outline">
                <Trans i18nKey="dashboard-scene.delete-provisioned-dashboard-form.cancel">Cancel</Trans>
              </Button>
            </Stack>
          </Stack>
        </form>
      </FormProvider>
    </Drawer>
  );
}
