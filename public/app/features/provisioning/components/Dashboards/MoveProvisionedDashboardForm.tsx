import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Alert, Button, Drawer, Field, Input, Spinner, Stack } from '@grafana/ui';
import { useGetFolderQuery } from 'app/api/clients/folder/v1beta1';
import {
  RepositoryView,
  useCreateRepositoryFilesWithPathMutation,
  useGetRepositoryFilesWithPathQuery,
} from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { ProvisionedOperationInfo, useProvisionedRequestHandler } from '../../hooks/useProvisionedRequestHandler';
import { ProvisionedDashboardFormData } from '../../types/form';
import { buildResourceBranchRedirectUrl } from '../../utils/redirect';
import { useBulkActionJob } from '../BulkActions/useBulkActionJob';
import { getTargetFolderPathInRepo } from '../BulkActions/utils';
import { ResourceEditFormSharedFields } from '../Shared/ResourceEditFormSharedFields';

export interface Props {
  dashboard: DashboardScene;
  defaultValues: ProvisionedDashboardFormData;
  readOnly: boolean;
  isNew?: boolean;
  workflowOptions: Array<{ label: string; value: string }>;
  loadedFromRef?: string;
  targetFolderUID?: string;
  targetFolderTitle?: string;
  repository?: RepositoryView;
  onDismiss: () => void;
  onSuccess: (folderUID: string, folderTitle: string) => void;
}

export function MoveProvisionedDashboardForm({
  dashboard,
  defaultValues,
  loadedFromRef,
  readOnly,
  isNew,
  workflowOptions,
  targetFolderUID,
  targetFolderTitle,
  repository,
  onDismiss,
}: Props) {
  const methods = useForm<ProvisionedDashboardFormData>({ defaultValues });
  const { editPanel: panelEditor } = dashboard.useState();

  const { handleSubmit, watch } = methods;
  const appEvents = getAppEvents();

  const [ref, workflow] = watch(['ref', 'workflow']);

  const { data: currentFileData, isLoading: isLoadingFileData } = useGetRepositoryFilesWithPathQuery({
    name: defaultValues.repo,
    path: defaultValues.path,
  });

  const { data: targetFolder } = useGetFolderQuery(targetFolderUID ? { name: targetFolderUID! } : skipToken);

  const { createBulkJob, isLoading: isCreatingJob } = useBulkActionJob();
  const [moveFile, moveRequest] = useCreateRepositoryFilesWithPathMutation();
  const [targetPath, setTargetPath] = useState<string>('');

  const navigate = useNavigate();

  useEffect(() => {
    const currentSourcePath = currentFileData?.resource?.dryRun?.metadata?.annotations?.[AnnoKeySourcePath];
    if (!currentSourcePath || targetFolderUID === undefined) {
      return;
    }

    const filename = currentSourcePath.split('/').pop();
    const targetFolderPath = getTargetFolderPathInRepo({
      targetFolderUID,
      targetFolder,
      repoName: repository?.name,
      hidePrependSlash: true,
    });
    const newPath = `${targetFolderPath}${filename}`;
    setTargetPath(newPath);
  }, [currentFileData, targetFolder, targetFolderUID, targetFolderTitle, repository]);

  // Helper function to show error messages
  const showError = (error?: unknown) => {
    const payload = [t('dashboard-scene.move-provisioned-dashboard-form.api-error', 'Failed to move dashboard'), error];

    appEvents.publish({
      type: AppEvents.alertError.name,
      payload,
    });
  };

  const handleSubmitForm = async ({ repo, path, comment }: ProvisionedDashboardFormData) => {
    if (!repo || !repository) {
      showError();
      return;
    }

    const targetFolderPath = getTargetFolderPathInRepo({
      targetFolderUID,
      targetFolder,
      repoName: repository?.name,
    });

    if (!targetFolderPath) {
      showError();
      return;
    }

    // Branch workflow: use /files API for direct file operations
    if (workflow === 'branch') {
      if (!currentFileData?.resource?.file) {
        appEvents.publish({
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

      const branchRef = ref;
      const commitMessage = comment || `Move dashboard: ${dashboard.state.title}`;

      try {
        await moveFile({
          name: repo,
          path: targetPath,
          ref: branchRef,
          message: commitMessage,
          body: currentFileData.resource.file,
          originalPath: path,
        }).unwrap();
      } catch (error) {
        showError(error);
      }
      return;
    }

    // Write workflow: use Job API
    const effectiveRef = isNew ? undefined : loadedFromRef;
    const jobSpec = {
      action: 'move' as const,
      move: {
        ref: effectiveRef,
        targetPath: targetFolderPath,
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
        showError();
        return;
      }

      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: [
          t(
            'dashboard-scene.move-provisioned-dashboard-form.queued',
            'Dashboard move has been queued and will be processed in the background. You can continue working while the changes are applied.'
          ),
        ],
      });
      onDismiss();
    } catch (error) {
      showError(error);
    }
  };

  const onBranchSuccess = (info: ProvisionedOperationInfo) => {
    dashboard.setState({ isDirty: false });
    panelEditor?.onDiscard();
    const url = buildResourceBranchRedirectUrl({
      paramName: 'new_pull_request_url',
      paramValue: moveRequest?.data?.urls?.newPullRequestURL,
      repoType: info.repoType,
    });
    navigate(url);
  };

  useProvisionedRequestHandler({
    request: moveRequest,
    workflow,
    resourceType: 'dashboard',
    successMessage: t(
      'dashboard-scene.move-provisioned-dashboard-form.success-message',
      'Dashboard moved successfully'
    ),
    handlers: {
      onBranchSuccess: (_, info) => onBranchSuccess(info),
      onDismiss,
      onError: showError,
    },
  });

  const isLoading = isCreatingJob || moveRequest.isLoading;

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
                  {t(
                    'dashboard-scene.move-provisioned-dashboard-form.loading-dashboard-data',
                    'Loading dashboard data'
                  )}
                </div>
              </Stack>
            )}

            {currentFileData?.errors?.length && currentFileData.errors.length > 0 && (
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
              repository={repository}
            />

            <Stack gap={2}>
              <Button variant="secondary" onClick={onDismiss} fill="outline">
                <Trans i18nKey="dashboard-scene.move-provisioned-dashboard-form.cancel-action">Cancel</Trans>
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={isLoading || readOnly || isLoadingFileData || !currentFileData?.resource?.file}
              >
                {isLoading
                  ? t('dashboard-scene.move-provisioned-dashboard-form.moving', 'Moving...')
                  : t('dashboard-scene.move-provisioned-dashboard-form.move-action', 'Move dashboard')}
              </Button>
            </Stack>
          </Stack>
        </form>
      </FormProvider>
    </Drawer>
  );
}
