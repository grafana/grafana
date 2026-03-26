import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Field, Input, Stack } from '@grafana/ui';
import { RepositoryView, useCreateRepositoryFilesWithPathMutation } from 'app/api/clients/provisioning/v0alpha1';
import { useUrlParams } from 'app/core/navigation/hooks';
import { FolderDTO } from 'app/types/folders';

import { ProvisioningAlert } from '../../Shared/ProvisioningAlert';
import { useProvisionedFolderFormData } from '../../hooks/useProvisionedFolderFormData';
import { ProvisionedOperationInfo, useProvisionedRequestHandler } from '../../hooks/useProvisionedRequestHandler';
import { BaseProvisionedFormData } from '../../types/form';
import { RepoInvalidStateBanner } from '../Shared/RepoInvalidStateBanner';
import { ResourceEditFormSharedFields } from '../Shared/ResourceEditFormSharedFields';
import { getProvisionedRequestError } from '../utils/errors';
import { splitPath } from '../utils/path';

interface FormProps extends RenameProvisionedFolderFormProps {
  initialValues: BaseProvisionedFormData;
  repository?: RepositoryView;
}

interface RenameProvisionedFolderFormProps {
  folder: FolderDTO;
  onDismiss?: () => void;
}

function FormContent({ initialValues, folder, repository, onDismiss }: FormProps) {
  const [error, setError] = useState<string | undefined>(undefined);
  const [createFile, request] = useCreateRepositoryFilesWithPathMutation();

  const methods = useForm<BaseProvisionedFormData>({
    defaultValues: initialValues,
    mode: 'onBlur',
  });
  const { handleSubmit, watch, register, formState } = methods;
  const [ref, workflow] = watch(['ref', 'workflow']);

  const showError = (error: unknown) => {
    setError(
      getProvisionedRequestError(
        error,
        'folder',
        t('browse-dashboards.rename-provisioned-folder-form.error-saving', 'Failed to rename folder')
      )
    );
  };

  const [, updateUrlParams] = useUrlParams();

  const onBranchSuccess = ({ urls }: { urls?: Record<string, string> }, info: ProvisionedOperationInfo) => {
    const prUrl = urls?.newPullRequestURL;
    const params: Record<string, string> = {};

    if (prUrl) {
      // Backend returned a PR creation URL — show the "Open pull request" banner
      params.new_pull_request_url = prUrl;
    } else if (repository?.url) {
      // No PR URL (backend bug: moveDirectory doesn't populate URLs yet).
      // Fall back to repo_url which shows the "behind branch" banner variant.
      params.repo_url = repository.url;
    }
    if (info.repoType) {
      params.repo_type = info.repoType;
    }

    if (Object.keys(params).length > 0) {
      updateUrlParams(params);
    }
  };

  useProvisionedRequestHandler({
    request,
    workflow,
    resourceType: 'folder',
    repository,
    selectedBranch: ref,
    successMessage: t(
      'browse-dashboards.rename-provisioned-folder-form.success-message',
      'Folder renamed successfully'
    ),
    handlers: {
      onDismiss,
      onBranchSuccess,
      onError: showError,
    },
  });

  const doSave = async ({ ref, title, comment }: BaseProvisionedFormData) => {
    setError(undefined);
    const repoName = repository?.name;
    const originalPath = initialValues.path;

    if (!title || !repoName || !originalPath) {
      showError(t('browse-dashboards.rename-provisioned-folder-form.missing-info', 'Missing required fields'));
      return;
    }

    // Build the new path: same parent directory, new folder name.
    // splitPath handles root-level folders (no parent dir) correctly.
    const pathWithoutTrailingSlash = originalPath.replace(/\/+$/, '');
    const { directory: parentDir } = splitPath(pathWithoutTrailingSlash);
    const newPath = parentDir ? `${parentDir}/${title}/` : `${title}/`;
    const currentPath = pathWithoutTrailingSlash + '/';

    reportInteraction('grafana_provisioning_folder_rename_submitted', {
      workflow: 'branch',
      repositoryName: repoName,
      repositoryType: repository?.type ?? 'unknown',
    });

    // Rename is a move operation: POST with originalPath (current) and path (new).
    // Only branch workflow is supported for directory moves.
    createFile({
      ref,
      name: repoName,
      path: newPath,
      originalPath: currentPath,
      message: comment || t('browse-dashboards.rename-provisioned-folder-form.commit', 'Rename folder'),
      body: {}, // Backend ignores body for directory moves
    });
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(doSave)}>
        <Stack direction="column" gap={2}>
          <Field
            noMargin
            label={t('browse-dashboards.rename-provisioned-folder-form.label-folder-name', 'Folder name')}
            invalid={!!formState?.errors.title}
            error={formState?.errors.title?.message}
          >
            <Input
              {...register('title', {
                required: t(
                  'browse-dashboards.rename-provisioned-folder-form.title-required',
                  'Folder name is required'
                ),
              })}
              id="folder-name-input"
            />
          </Field>

          <ResourceEditFormSharedFields
            resourceType="folder"
            isNew={false}
            canPushToConfiguredBranch={false}
            repository={repository}
            hiddenFields={['path']}
          />

          {error && <ProvisioningAlert error={error} />}

          <Stack gap={2}>
            <Button variant="secondary" fill="outline" onClick={onDismiss}>
              {t('browse-dashboards.rename-provisioned-folder-form.button-cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={request.isLoading || !!formState?.errors.title}>
              {request.isLoading
                ? t('browse-dashboards.rename-provisioned-folder-form.button-renaming', 'Renaming...')
                : t('browse-dashboards.rename-provisioned-folder-form.button-rename', 'Rename')}
            </Button>
          </Stack>
        </Stack>
      </form>
    </FormProvider>
  );
}

export function RenameProvisionedFolderForm({ folder, onDismiss }: RenameProvisionedFolderFormProps) {
  const { repository, initialValues, isReadOnlyRepo } = useProvisionedFolderFormData({
    folderUid: folder.uid,
    title: folder.title,
  });

  if (isReadOnlyRepo || !initialValues) {
    return (
      <RepoInvalidStateBanner
        noRepository={!initialValues}
        isReadOnlyRepo={isReadOnlyRepo}
        readOnlyMessage={t(
          'browse-dashboards.rename-folder.read-only-message',
          'To rename this folder, please update the folder in your repository directly.'
        )}
      />
    );
  }

  return <FormContent folder={folder} onDismiss={onDismiss} initialValues={initialValues} repository={repository} />;
}
