import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Box, Button, Stack } from '@grafana/ui';
import { Folder } from 'app/api/clients/folder/v1beta1';
import { RepositoryView, useDeleteRepositoryFilesWithPathMutation } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import { DescendantCount } from 'app/features/browse-dashboards/components/BrowseActions/DescendantCount';
import { getFolderURL } from 'app/features/browse-dashboards/components/utils';
import { FolderDTO } from 'app/types/folders';

import { useProvisionedFolderFormData } from '../../hooks/useProvisionedFolderFormData';
import { ProvisionedOperationInfo, useProvisionedRequestHandler } from '../../hooks/useProvisionedRequestHandler';
import { BaseProvisionedFormData } from '../../types/form';
import { buildResourceBranchRedirectUrl } from '../../utils/redirect';
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

  const [deleteRepoFile, request] = useDeleteRepositoryFilesWithPathMutation();
  const navigate = useNavigate();

  const methods = useForm<BaseProvisionedFormData>({ defaultValues: initialValues });
  const { handleSubmit, watch } = methods;
  const workflow = watch('workflow');

  const handleSubmitForm = async ({ repo, path, comment, ref }: BaseProvisionedFormData) => {
    if (!repository?.name) {
      return;
    }

    const commitMessage = comment || `Delete folder: ${folder?.metadata?.annotations?.[AnnoKeySourcePath]}`;
    const targetRef = workflow === 'write' ? undefined : ref;

    deleteRepoFile({
      name: repo,
      path: `${path}/`,
      ref: targetRef,
      message: commitMessage,
    });
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

  const onWriteSuccess = () => {
    // Navigate back to parent folder if it exists, otherwise go to dashboards root
    if (parentFolder?.parentUid) {
      window.location.href = getFolderURL(parentFolder.parentUid);
    } else {
      window.location.href = '/dashboards';
    }
  };

  const onError = (error: unknown) => {
    getAppEvents().publish({
      type: AppEvents.alertError.name,
      payload: [t('browse-dashboards.delete-provisioned-folder-form.api-error', 'Failed to delete folder'), error],
    });
  };

  // Use the repository-type and resource-type aware provisioned request handler
  useProvisionedRequestHandler({
    request,
    workflow,
    successMessage: t(
      'browse-dashboards.delete-provisioned-folder-form.success-message',
      'Folder deleted successfully'
    ),
    resourceType: 'folder',
    repository,
    handlers: {
      onDismiss,
      onBranchSuccess,
      onWriteSuccess,
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

          {/* Delete / Cancel button */}
          <Stack gap={2}>
            <Button type="submit" disabled={request.isLoading} variant="destructive">
              {request.isLoading
                ? t('browse-dashboards.delete-provisioned-folder-form.button-deleting', 'Deleting...')
                : t('browse-dashboards.delete-provisioned-folder-form.button-delete', 'Delete')}
            </Button>
            <Button variant="secondary" fill="outline" onClick={onDismiss}>
              <Trans i18nKey="browse-dashboards.delete-provisioned-folder-form.button-cancel">Cancel</Trans>
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
