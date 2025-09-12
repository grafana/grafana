import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Box, Button, Stack } from '@grafana/ui';
import { Folder } from 'app/api/clients/folder/v1beta1';
import { RepositoryView, useDeleteRepositoryFilesWithPathMutation } from 'app/api/clients/provisioning/v0alpha1';
import { DescendantCount } from 'app/features/browse-dashboards/components/BrowseActions/DescendantCount';
import { FolderDTO } from 'app/types/folders';

import { useProvisionedFolderFormData } from '../../hooks/useProvisionedFolderFormData';
import { ProvisionedOperationInfo, useProvisionedRequestHandler } from '../../hooks/useProvisionedRequestHandler';
import { BaseProvisionedFormData } from '../../types/form';
import { buildResourceBranchRedirectUrl } from '../../utils/redirect';
import { useBulkActionJob } from '../BulkActions/useBulkActionJob';
import { RepoInvalidStateBanner } from '../Shared/RepoInvalidStateBanner';
import { ResourceEditFormSharedFields } from '../Shared/ResourceEditFormSharedFields';

interface FormProps extends DeleteProvisionedFolderFormProps {
  initialValues: BaseProvisionedFormData;
  repository?: RepositoryView;
  workflowOptions: Array<{ label: string; value: string }>;
  folder?: Folder;
}

interface DeleteProvisionedFolderFormProps {
  parentFolder?: FolderDTO;
  onDismiss?: () => void;
}

function FormContent({ initialValues, parentFolder, repository, workflowOptions, folder, onDismiss }: FormProps) {
  const resourceId = parentFolder?.uid || '';
  const { createBulkJob, isLoading } = useBulkActionJob();
  const [deleteRepoFile, deleteRequest] = useDeleteRepositoryFilesWithPathMutation();
  const navigate = useNavigate();

  const methods = useForm<BaseProvisionedFormData>({ defaultValues: initialValues });
  const { handleSubmit, watch } = methods;
  const [ref, workflow] = watch(['ref', 'workflow']);

  // Helper function to show error messages
  const showError = (error?: unknown) => {
    const payload = [t('browse-dashboards.delete-provisioned-folder-form.api-error', 'Failed to delete folder'), error];

    getAppEvents().publish({
      type: AppEvents.alertError.name,
      payload,
    });
  };

  const handleSubmitForm = async ({ repo, path, comment }: BaseProvisionedFormData) => {
    if (!repo || !repository) {
      showError();
      return;
    }

    // Branch workflow: use /files API for direct file operations
    if (workflow === 'branch') {
      const branchRef = ref;
      const commitMessage = comment || t('browse-dashboards.delete-provisioned-folder-form.commit', 'Delete folder');

      try {
        await deleteRepoFile({
          name: repo,
          path: `${path}/`,
          ref: branchRef,
          message: commitMessage,
        }).unwrap();
      } catch (error) {
        showError(error);
      }
      return;
    }

    // Write workflow: use Job API
    const jobSpec = {
      action: 'delete' as const,
      delete: {
        ref: undefined,
        resources: [
          {
            name: resourceId,
            group: 'folder.grafana.app' as const,
            kind: 'Folder' as const,
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

      getAppEvents().publish({
        type: AppEvents.alertSuccess.name,
        payload: [
          t(
            'browse-dashboards.delete-provisioned-folder-form.queued',
            'Delete queued. Changes will be applied shortly.'
          ),
        ],
      });
      onDismiss?.();
    } catch (error) {
      showError(error);
    }
  };

  const onBranchSuccess = ({ urls }: { urls?: Record<string, string> }, info: ProvisionedOperationInfo) => {
    const prUrl = urls?.newPullRequestURL;
    if (prUrl) {
      const url = buildResourceBranchRedirectUrl({
        paramName: 'new_pull_request_url',
        paramValue: prUrl,
        repoType: info.repoType,
      });
      navigate(url);
    }
  };

  const onError = (error: unknown) => {
    showError(error);
  };

  useProvisionedRequestHandler({
    request: deleteRequest,
    workflow,
    resourceType: 'folder',
    successMessage: t(
      'browse-dashboards.delete-provisioned-folder-form.success-message',
      'Folder deleted successfully'
    ),
    handlers: {
      onDismiss,
      onBranchSuccess,
      onError,
    },
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(handleSubmitForm)}>
        <Stack direction="column" gap={2}>
          <Box paddingBottom={2}>
            <Trans i18nKey="browse-dashboards.delete-provisioned-folder-form.delete-warning">
              This will delete this folder and all its descendants. In total, this will affect:
            </Trans>
            <DescendantCount
              selectedItems={{
                folder: { [resourceId]: true },
                dashboard: {},
                panel: {},
                $all: false,
              }}
            />
          </Box>

          <ResourceEditFormSharedFields
            resourceType="folder"
            isNew={false}
            workflow={workflow}
            workflowOptions={workflowOptions}
            repository={repository}
          />

          <Stack gap={2}>
            <Button variant="secondary" fill="outline" onClick={onDismiss}>
              <Trans i18nKey="browse-dashboards.delete-provisioned-folder-form.button-cancel">Cancel</Trans>
            </Button>
            <Button type="submit" disabled={isLoading || deleteRequest.isLoading} variant="destructive">
              {isLoading || deleteRequest.isLoading
                ? t('browse-dashboards.delete-provisioned-folder-form.button-deleting', 'Deleting...')
                : t('browse-dashboards.delete-provisioned-folder-form.button-delete', 'Delete')}
            </Button>
          </Stack>
        </Stack>
      </form>
    </FormProvider>
  );
}

export function DeleteProvisionedFolderForm({ parentFolder, onDismiss }: DeleteProvisionedFolderFormProps) {
  const { workflowOptions, repository, folder, initialValues, isReadOnlyRepo } = useProvisionedFolderFormData({
    folderUid: parentFolder?.uid,
    title: parentFolder?.title,
  });

  if (isReadOnlyRepo || !initialValues) {
    return (
      <RepoInvalidStateBanner
        noRepository={!initialValues}
        isReadOnlyRepo={isReadOnlyRepo}
        readOnlyMessage={t(
          'browse-dashboards.delete-folder.read-only-message',
          'To delete this folder, please remove the folder from your repository.'
        )}
      />
    );
  }

  return (
    <FormContent
      parentFolder={parentFolder}
      onDismiss={onDismiss}
      initialValues={initialValues}
      repository={repository}
      workflowOptions={workflowOptions}
      folder={folder}
    />
  );
}
