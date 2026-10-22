import { useCallback, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Stack } from '@grafana/ui';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { AffectedFolderContents } from 'app/features/browse-dashboards/components/BrowseActions/AffectedFolderContents';
import { type FolderDTO } from 'app/types/folders';

import { ProvisioningAlert } from '../../Shared/ProvisioningAlert';
import { useCommitMessageTemplate } from '../../hooks/useCommitMessageTemplate';
import { useCommitTarget } from '../../hooks/useCommitTarget';
import { useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';
import { useProvisionedFolderFormData } from '../../hooks/useProvisionedFolderFormData';
import { type BaseProvisionedFormData } from '../../types/form';
import { type CommitTemplateVars } from '../../utils/commitMessage';
import { getCurrentCommitUser } from '../../utils/currentUser';
import { getJobListRedirectUrl } from '../../utils/redirect';
import { getRequestRef } from '../../utils/workflow';
import { type DeleteJobSpec, type SubmittedJob, useBulkActionJob } from '../BulkActions/useBulkActionJob';
import { ProvisionedFormGate } from '../ProvisionedFormGate';
import { ResourceEditFormSharedFields } from '../Shared/ResourceEditFormSharedFields';
import { type JobSuccess, ResourceJobStatus } from '../Shared/ResourceJobStatus';
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
  const [submitted, setSubmitted] = useState<SubmittedJob>();
  const [error, setError] = useState<string | undefined>(undefined);

  // hooks
  const { createBulkJob, isLoading } = useBulkActionJob();
  const navigate = useNavigate();
  const methods = useForm<BaseProvisionedFormData>({ defaultValues: initialValues });
  const { handleSubmit, watch } = methods;
  const ref = watch('ref') ?? '';

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

  const { workflow, isResolving, lockBranch, prTitle } = useCommitTarget({
    repository,
    vars: templateVars,
    ref,
    isRefDirty: Boolean(methods.formState.dirtyFields.ref),
    setRef: (value) => methods.setValue('ref', value, { shouldDirty: false }),
  });

  const showError = (error: unknown) => {
    setError(
      getProvisionedRequestError(
        error,
        t('browse-dashboards.delete-provisioned-folder-form.api-error', 'Failed to delete folder')
      )
    );
  };

  const handleSubmitForm = async ({ repo }: BaseProvisionedFormData) => {
    setError(undefined);
    if (!repo || !repository) {
      showError(t('browse-dashboards.delete-provisioned-folder-form.missing-info', 'Missing required fields'));
      return;
    }

    reportInteraction('grafana_provisioning_folder_delete_submitted', {
      workflow,
      repositoryName: repo,
      repositoryType: repository.type ?? 'unknown',
    });

    const jobSpec: DeleteJobSpec = {
      action: 'delete',
      message,
      delete: {
        ref: getRequestRef(repository, ref),
        resources: [{ name: resourceId, group: 'folder.grafana.app', kind: 'Folder' }],
      },
    };

    try {
      const result = await createBulkJob(repository, jobSpec);
      if (!result.success) {
        showError(result.error);
        return;
      }

      if (result.job) {
        setSubmitted({ job: result.job, workflow, prTitle });
      }
    } catch (error) {
      showError(error);
    }
  };

  const handleJobSuccess = useCallback(
    ({ urls }: JobSuccess) => {
      if (!submitted) {
        return;
      }
      onDismiss?.();
      navigate(
        getJobListRedirectUrl({
          workflow: submitted.workflow,
          urls,
          repoType: repository?.type,
          action: 'delete',
          prTitle: submitted.prTitle,
        })
      );
    },
    [onDismiss, navigate, submitted, repository?.type]
  );

  return (
    <>
      {submitted ? (
        <ResourceJobStatus job={submitted.job} jobType="delete" onSuccess={handleJobSuccess} />
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
                  'Selected folder contains resources that will be deleted'
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
                <Button type="submit" disabled={isLoading || isResolving} variant="destructive">
                  {isLoading
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
  const view = useGetResourceRepositoryView({ folderName: parentFolder?.uid });
  const { canPushToConfiguredBranch, repository, initialValues, isReadOnlyRepo, isMissingRepo, isLoading } =
    useProvisionedFolderFormData({
      view,
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
