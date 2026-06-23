import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Stack } from '@grafana/ui';
import {
  type Job,
  type RepositoryView,
  useDeleteRepositoryFilesWithPathMutation,
} from 'app/api/clients/provisioning/v0alpha1';
import { AffectedFolderContents } from 'app/features/browse-dashboards/components/BrowseActions/AffectedFolderContents';
import { JobStatus } from 'app/features/provisioning/Job/JobStatus';
import { type StepStatusInfo } from 'app/features/provisioning/Wizard/types';
import { type FolderDTO } from 'app/types/folders';

import { ProvisioningAlert } from '../../Shared/ProvisioningAlert';
import { useBranchTemplate } from '../../hooks/useBranchTemplate';
import { useCommitMessageTemplate } from '../../hooks/useCommitMessageTemplate';
import { useProvisionedFolderFormData } from '../../hooks/useProvisionedFolderFormData';
import { type ProvisionedOperationInfo, useProvisionedRequestHandler } from '../../hooks/useProvisionedRequestHandler';
import { type BaseProvisionedFormData } from '../../types/form';
import { type CommitTemplateVars } from '../../utils/commitMessage';
import { getCurrentCommitUser } from '../../utils/currentUser';
import { buildResourceBranchRedirectUrl } from '../../utils/redirect';
import { useBulkActionJob } from '../BulkActions/useBulkActionJob';
import { ProvisionedFormGate } from '../ProvisionedFormGate';
import { ResourceEditFormSharedFields } from '../Shared/ResourceEditFormSharedFields';
import { getProvisionedRequestError } from '../utils/errors';

interface FormProps extends DeleteProvisionedFolderFormProps {
  initialValues: BaseProvisionedFormData;
  repository?: RepositoryView;
  canPushToConfiguredBranch: boolean;
}

interface DeleteProvisionedFolderFormProps {
  parentFolder?: FolderDTO;
  onDismiss?: () => void;
}

function FormContent({ initialValues, parentFolder, repository, canPushToConfiguredBranch, onDismiss }: FormProps) {
  const resourceId = parentFolder?.uid || '';

  // state
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [job, setJob] = useState<Job>();

  // hooks
  const { createBulkJob, isLoading } = useBulkActionJob();
  const [deleteRepoFile, request] = useDeleteRepositoryFilesWithPathMutation();
  const navigate = useNavigate();
  const methods = useForm<BaseProvisionedFormData>({ defaultValues: initialValues });
  const { handleSubmit, watch } = methods;
  const [ref, workflow] = watch(['ref', 'workflow']);

  const templateVars: CommitTemplateVars = {
    action: 'delete',
    resourceKind: 'folder',
    resourceID: parentFolder?.uid ?? '',
    title: parentFolder?.title ?? '',
    ...getCurrentCommitUser(),
  };
  const { locked, message } = useCommitMessageTemplate({
    repository,
    vars: templateVars,
    comment: watch('comment') ?? '',
    isCommentDirty: Boolean(methods.formState.dirtyFields.comment),
    setComment: (value) => methods.setValue('comment', value, { shouldDirty: false }),
  });

  const { locked: lockBranch } = useBranchTemplate({
    repository,
    vars: templateVars,
    workflow,
    setBranch: (value) => methods.setValue('ref', value, { shouldDirty: false }),
  });

  const showError = (error: unknown) => {
    setError(
      getProvisionedRequestError(
        error,
        'folder',
        t('browse-dashboards.delete-provisioned-folder-form.api-error', 'Failed to delete folder')
      )
    );
  };

  const onBranchSuccess = ({ urls }: { urls?: Record<string, string> }, info: ProvisionedOperationInfo) => {
    const prUrl = urls?.newPullRequestURL;
    if (prUrl) {
      const url = buildResourceBranchRedirectUrl({
        paramName: 'new_pull_request_url',
        paramValue: prUrl,
        repoType: info.repoType,
        action: 'delete',
      });
      navigate(url);
    }
  };

  const { handleSuccess } = useProvisionedRequestHandler({
    workflow,
    resourceType: 'folder',
    repository,
    selectedBranch: ref,
    successMessage: t(
      'browse-dashboards.delete-provisioned-folder-form.success-message',
      'Folder deleted successfully'
    ),
    handlers: {
      onDismiss,
      onBranchSuccess,
    },
  });

  const handleSubmitForm = async ({ repo, path }: BaseProvisionedFormData) => {
    setError(undefined);
    if (!repo || !repository) {
      showError(t('browse-dashboards.delete-provisioned-folder-form.missing-info', 'Missing required fields'));
      return;
    }

    reportInteraction('grafana_provisioning_folder_delete_submitted', {
      workflow,
      repositoryName: repo,
      repositoryType: repository?.type ?? 'unknown',
    });

    // Branch workflow: use /files API for direct file operations
    if (workflow === 'branch') {
      const branchRef = ref;

      try {
        const data = await deleteRepoFile({
          name: repo,
          path,
          ref: branchRef,
          message,
        }).unwrap();
        handleSuccess(data);
      } catch (error) {
        showError(error);
      }
      return;
    }

    // Write workflow: use Job API
    const jobSpec = {
      action: 'delete' as const,
      message,
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
        showError(result.error);
        return;
      }

      if (result.job) {
        setJob(result.job);
        setHasSubmitted(true);
      }
    } catch (error) {
      showError(error);
    }
  };

  const handleJobStatusChange = (statusInfo: StepStatusInfo) => {
    if (statusInfo.status === 'success') {
      onDismiss?.();
      navigate('/dashboards');
    }
  };

  return (
    <>
      {hasSubmitted && job ? (
        <JobStatus watch={job} jobType="delete" onStatusChange={handleJobStatusChange} />
      ) : (
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(handleSubmitForm)}>
            <Stack direction="column" gap={2}>
              <AffectedFolderContents
                selectedItems={{ folder: { [resourceId]: true }, dashboard: {} }}
                defaultMessage={
                  <Trans i18nKey="browse-dashboards.delete-provisioned-folder-form.delete-warning">
                    This will delete this folder and all its descendants.
                  </Trans>
                }
                emptyMessage={t(
                  'browse-dashboards.delete-provisioned-folder-form.folder-empty',
                  'Selected folder is empty'
                )}
                nonEmptyMessage={t(
                  'browse-dashboards.delete-provisioned-folder-form.folder-not-empty',
                  'Selected folder contains other resources that will be deleted'
                )}
              />

              <ResourceEditFormSharedFields
                resourceType="folder"
                isNew={false}
                canPushToConfiguredBranch={canPushToConfiguredBranch}
                repository={repository}
                lockComment={locked}
                commitMessage={message}
                lockBranch={lockBranch}
              />

              {error && <ProvisioningAlert error={error} />}

              <Stack gap={2}>
                <Button variant="secondary" fill="outline" onClick={onDismiss}>
                  <Trans i18nKey="browse-dashboards.delete-provisioned-folder-form.button-cancel">Cancel</Trans>
                </Button>
                <Button type="submit" disabled={isLoading || request.isLoading} variant="destructive">
                  {isLoading || request.isLoading
                    ? t('browse-dashboards.delete-provisioned-folder-form.button-deleting', 'Deleting...')
                    : t('browse-dashboards.delete-provisioned-folder-form.button-delete', 'Delete')}
                </Button>
              </Stack>
            </Stack>
          </form>
        </FormProvider>
      )}
    </>
  );
}

export function DeleteProvisionedFolderForm({ parentFolder, onDismiss }: DeleteProvisionedFolderFormProps) {
  const { canPushToConfiguredBranch, repository, initialValues, isReadOnlyRepo, isMissingRepo, isLoading } =
    useProvisionedFolderFormData({
      folderUid: parentFolder?.uid,
      title: parentFolder?.title,
    });

  return (
    <ProvisionedFormGate
      isLoading={isLoading}
      isMissingRepo={isMissingRepo}
      isReadOnly={isReadOnlyRepo}
      readOnlyMessage={t(
        'browse-dashboards.delete-folder.read-only-message',
        'To delete this folder, please remove the folder from your repository.'
      )}
    >
      {initialValues && (
        <FormContent
          parentFolder={parentFolder}
          onDismiss={onDismiss}
          initialValues={initialValues}
          repository={repository}
          canPushToConfiguredBranch={canPushToConfiguredBranch}
        />
      )}
    </ProvisionedFormGate>
  );
}
