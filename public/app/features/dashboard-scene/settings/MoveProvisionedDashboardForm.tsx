import { useState, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Alert, Button, Drawer, Field, Input, Spinner, Stack } from '@grafana/ui';
import { useGetFolderQuery } from 'app/api/clients/folder/v1beta1';
import {
  useGetRepositoryFilesWithPathQuery,
  useCreateRepositoryFilesWithPathMutation,
  useDeleteRepositoryFilesWithPathMutation,
} from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';

import { ResourceEditFormSharedFields } from '../components/Provisioned/ResourceEditFormSharedFields';
import { ProvisionedDashboardFormData } from '../saving/shared';
import { DashboardScene } from '../scene/DashboardScene';
import { useProvisionedRequestHandler } from '../utils/useProvisionedRequestHandler';

export interface Props {
  dashboard: DashboardScene;
  defaultValues: ProvisionedDashboardFormData;
  readOnly: boolean;
  isGitHub: boolean;
  isNew?: boolean;
  workflowOptions: Array<{ label: string; value: string }>;
  loadedFromRef?: string;
  targetFolderUID?: string;
  targetFolderTitle?: string;
  onDismiss: () => void;
  onSuccess: (folderUID: string, folderTitle: string) => void;
}

/**
 * @description
 * Drawer component for moving a git provisioned dashboard to a different folder.
 */
export function MoveProvisionedDashboardForm({
  dashboard,
  defaultValues,
  loadedFromRef,
  readOnly,
  isGitHub,
  isNew,
  workflowOptions,
  targetFolderUID,
  targetFolderTitle,
  onDismiss,
  onSuccess,
}: Props) {
  const methods = useForm<ProvisionedDashboardFormData>({ defaultValues });
  const { editPanel: panelEditor } = dashboard.useState();
  const { handleSubmit, watch } = methods;

  const [ref, workflow] = watch(['ref', 'workflow']);

  const { data: currentFileData, isLoading: isLoadingFileData } = useGetRepositoryFilesWithPathQuery({
    name: defaultValues.repo,
    path: defaultValues.path,
  });

  const { data: targetFolder } = useGetFolderQuery({ name: targetFolderUID! }, { skip: !targetFolderUID });

  const [createFile, createRequest] = useCreateRepositoryFilesWithPathMutation();
  const [deleteFile, deleteRequest] = useDeleteRepositoryFilesWithPathMutation();
  const [targetPath, setTargetPath] = useState<string>('');

  useEffect(() => {
    if (!targetFolderUID || !currentFileData?.resource?.dryRun?.metadata?.annotations || !targetFolder) {
      return;
    }

    const currentSourcePath = currentFileData.resource.dryRun.metadata.annotations[AnnoKeySourcePath];
    if (!currentSourcePath) {
      return;
    }

    const folderAnnotations = targetFolder.metadata.annotations || {};
    const targetFolderPath = folderAnnotations[AnnoKeySourcePath] || targetFolderTitle;

    const filename = currentSourcePath.split('/').pop();
    const newPath = `${targetFolderPath}/${filename}`;

    setTargetPath(newPath);
  }, [currentFileData, targetFolder, targetFolderUID, targetFolderTitle]);

  const handleSubmitForm = async ({ repo, path, comment }: ProvisionedDashboardFormData) => {
    // Validation: Check required fields
    if (!repo || !path) {
      console.error('Missing required fields for move:', { repo, path });
      getAppEvents().publish({
        type: AppEvents.alertError.name,
        payload: [
          t('dashboard-scene.move-provisioned-dashboard-form.missing-fields-error', 'Missing required fields for move'),
        ],
      });
      return;
    }

    if (!currentFileData?.resource?.file) {
      console.error('Current dashboard file could not be found');
      getAppEvents().publish({
        type: AppEvents.alertError.name,
        payload: [
          t(
            'dashboard-scene.move-provisioned-dashboard-form.current-file-not-found',
            'Current dashboard file could not be found'
          ),
        ],
      });
      return;
    }

    if (!targetPath) {
      console.error('Could not calculate target path');
      getAppEvents().publish({
        type: AppEvents.alertError.name,
        payload: [
          t('dashboard-scene.move-provisioned-dashboard-form.target-path-error', 'Could not calculate target path'),
        ],
      });
      return;
    }

    const branchRef = workflow === 'write' ? loadedFromRef : ref;
    const commitMessage = comment || `Move dashboard: ${dashboard.state.title}`;

    try {
      await createFile({
        name: repo,
        path: targetPath,
        ref: branchRef,
        message: commitMessage,
        body: currentFileData.resource.file,
      }).unwrap();

      await deleteFile({
        name: repo,
        path: path,
        ref: branchRef,
        message: commitMessage,
      }).unwrap();
    } catch (error) {
      if (createRequest.isSuccess && !deleteRequest.isSuccess) {
        getAppEvents().publish({
          type: AppEvents.alertWarning.name,
          payload: [
            t(
              'dashboard-scene.move-provisioned-dashboard-form.partial-failure-warning',
              'Dashboard was created at new location but could not be deleted from original location. Please manually remove the old file.'
            ),
          ],
        });
      }
      console.error('Move operation failed:', error);
    }
  };

  const navigate = useNavigate();

  const onRequestError = (error: unknown) => {
    getAppEvents().publish({
      type: AppEvents.alertError.name,
      payload: [t('dashboard-scene.move-provisioned-dashboard-form.api-error', 'Failed to move dashboard'), error],
    });
  };

  const onWriteSuccess = () => {
    panelEditor?.onDiscard();
    onDismiss();
    if (targetFolderUID && targetFolderTitle) {
      onSuccess(targetFolderUID, targetFolderTitle);
    }
    navigate('/dashboards');
  };

  const onBranchSuccess = (path: string, urls?: Record<string, string>) => {
    panelEditor?.onDiscard();
    onDismiss();
    navigate('/dashboards');
  };

  useProvisionedRequestHandler({
    dashboard,
    request: createRequest,
    workflow,
    handlers: {
      onBranchSuccess: ({ path, urls }) => onBranchSuccess(path, urls),
      onWriteSuccess,
      onError: onRequestError,
    },
  });

  const isLoading = createRequest.isLoading || deleteRequest.isLoading;

  return (
    <Drawer
      title={t('dashboard-scene.move-provisioned-dashboard-form.drawer-title', 'Move Provisioned Dashboard')}
      subtitle={dashboard.state.title}
      onClose={onDismiss}
    >
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
                  This dashboard cannot be moved directly from Grafana because the repository is read-only. To move this
                  dashboard, please move the file in your Git repository.
                </Trans>
              </Alert>
            )}

            {isLoadingFileData && (
              <Stack alignItems="center" gap={2}>
                <Spinner />
                <div>
                  {t('dashboard-scene.move-provisioned-dashboard-form.loading-file-data', 'Loading dashboard data')}
                </div>
              </Stack>
            )}

            {currentFileData?.errors && currentFileData.errors.length > 0 && (
              <Alert
                title={t('dashboard-scene.move-provisioned-dashboard-form.file-load-error', 'Error loading dashboard')}
                severity="error"
              >
                {currentFileData.errors.map((error, index) => (
                  <div key={index}>{error}</div>
                ))}
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
              workflow={workflow}
              workflowOptions={workflowOptions}
              isGitHub={isGitHub}
            />

            <Stack gap={2}>
              <Button
                variant="primary"
                type="submit"
                disabled={isLoading || readOnly || !currentFileData || isLoadingFileData}
              >
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
    </Drawer>
  );
}
