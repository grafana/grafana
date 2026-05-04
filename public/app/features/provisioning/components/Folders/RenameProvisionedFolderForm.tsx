import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Field, Input, Stack } from '@grafana/ui';
import { folderAPIv1beta1 } from 'app/api/clients/folder/v1beta1';
import { type RepositoryView, useReplaceRepositoryFilesWithPathMutation } from 'app/api/clients/provisioning/v0alpha1';
import { useUrlParams } from 'app/core/navigation/hooks';
import { browseDashboardsAPI } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { type FolderDTO } from 'app/types/folders';
import { useDispatch } from 'app/types/store';

import { ProvisioningAlert } from '../../Shared/ProvisioningAlert';
import { useProvisionedFolderFormData } from '../../hooks/useProvisionedFolderFormData';
import { type ProvisionedOperationInfo, useProvisionedRequestHandler } from '../../hooks/useProvisionedRequestHandler';
import { type BaseProvisionedFormData } from '../../types/form';
import { renderCommitMessage } from '../../utils/commitMessage';
import { RepoInvalidStateBanner } from '../Shared/RepoInvalidStateBanner';
import { ResourceEditFormSharedFields } from '../Shared/ResourceEditFormSharedFields';
import { getProvisionedRequestError } from '../utils/errors';
interface FormProps extends RenameProvisionedFolderFormProps {
  initialValues: BaseProvisionedFormData;
  repository?: RepositoryView;
  canPushToConfiguredBranch: boolean;
}

interface RenameProvisionedFolderFormProps {
  folder: FolderDTO;
  onDismiss?: () => void;
}

function FormContent({ initialValues, folder, repository, canPushToConfiguredBranch, onDismiss }: FormProps) {
  const dispatch = useDispatch();
  const [error, setError] = useState<string | undefined>(undefined);
  const [replaceFile, request] = useReplaceRepositoryFilesWithPathMutation();

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

  const onBranchSuccess = (
    { urls }: { ref: string; path: string; urls?: Record<string, string> },
    info: ProvisionedOperationInfo
  ) => {
    const prUrl = urls?.newPullRequestURL;
    // Fall back to the repository URL so the banner link button stays visible
    // even for providers that don't return a PR URL (Bitbucket, generic git).
    const linkUrl = prUrl ?? repository?.url ?? '';

    // locationService.partial merges with existing params, so explicitly clear
    // competing banner params to avoid stale state from previous attempts.
    const params: Record<string, string | null> = {
      new_pull_request_url: linkUrl || null,
      repo_url: null,
      resource_pushed_to: null,
      pull_request_url: null,
      repo_type: info.repoType ?? null,
      action: 'update',
    };

    updateUrlParams(params);
  };

  const onWriteSuccess = () => {
    // Invalidate folder caches so the page header and breadcrumbs pick up the new title.
    dispatch(folderAPIv1beta1.util.invalidateTags([{ type: 'Folder', id: folder.uid }]));
    dispatch(browseDashboardsAPI.util.invalidateTags(['getFolder']));
    onDismiss?.();
  };

  useProvisionedRequestHandler({
    request,
    workflow,
    resourceType: 'folder',
    folderUID: folder.uid,
    repository,
    selectedBranch: ref,
    successMessage: t(
      'browse-dashboards.rename-provisioned-folder-form.success-message',
      'Folder renamed successfully'
    ),
    handlers: {
      onDismiss,
      onWriteSuccess,
      onBranchSuccess,
      onError: showError,
    },
  });

  const doSave = async ({ ref, title, workflow, comment }: BaseProvisionedFormData) => {
    setError(undefined);
    const repoName = repository?.name;
    const folderPath = initialValues.path;

    if (!title || !repoName || !folderPath) {
      showError(t('browse-dashboards.rename-provisioned-folder-form.missing-info', 'Missing required fields'));
      return;
    }

    // For write workflow, write to the configured branch; otherwise use the selected branch
    const branchRef = workflow === 'write' ? undefined : ref;

    reportInteraction('grafana_provisioning_folder_rename_submitted', {
      workflow,
      repositoryName: repoName,
      repositoryType: repository?.type ?? 'unknown',
    });

    // Success/error handling is done by useProvisionedRequestHandler via the `request` object.
    replaceFile({
      name: repoName,
      path: folderPath,
      ref: branchRef,
      message:
        comment ||
        renderCommitMessage(repository?.commit?.singleResourceMessageTemplate, {
          action: 'rename',
          resourceKind: 'folder',
          resourceID: folder.uid,
          title,
        }),
      body: {
        spec: { title },
      },
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
            canPushToConfiguredBranch={canPushToConfiguredBranch}
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
  const { repository, initialValues, isReadOnlyRepo, canPushToConfiguredBranch } = useProvisionedFolderFormData({
    folderUid: folder.uid,
    title: folder.title,
    branchPrefix: 'folder-rename',
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

  return (
    <FormContent
      folder={folder}
      onDismiss={onDismiss}
      initialValues={initialValues}
      repository={repository}
      canPushToConfiguredBranch={canPushToConfiguredBranch}
    />
  );
}
