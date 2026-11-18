import { useRef } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents, reportInteraction } from '@grafana/runtime';
import { Button, Stack } from '@grafana/ui';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { extractErrorMessage } from 'app/api/utils';
import { AffectedFolderContents } from 'app/features/browse-dashboards/components/BrowseActions/AffectedFolderContents';
import { collectSelectedItems, getSelectedUIDs } from 'app/features/browse-dashboards/utils/dashboards';
import {
  RepoViewStatus,
  useGetResourceRepositoryView,
} from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { isRootFolderUID } from 'app/features/search/constants';

import { useCommitMessageTemplate } from '../../hooks/useCommitMessageTemplate';
import { getJobRef, useResourceJob } from '../../hooks/useResourceJob';
import { useSelectionRepoValidation } from '../../hooks/useSelectionRepoValidation';
import { type DeleteJobSpec } from '../../types/job';
import { type CommitTemplateVars } from '../../utils/commitMessage';
import { getCurrentCommitUser } from '../../utils/currentUser';
import { getRequestRef, getWorkflowForRef } from '../../utils/workflow';
import { ProvisionedFormGate } from '../ProvisionedFormGate';
import { ResourceEditFormSharedFields } from '../Shared/ResourceEditFormSharedFields';
import { ResourceJobStatus } from '../Shared/ResourceJobStatus';
import { getCanPushToConfiguredBranch } from '../defaults';

import {
  type BulkActionFormData,
  type BulkActionProvisionResourceProps,
  getBulkActionInitialValues,
  getSelectedResourceCountSummary,
} from './utils';

interface FormProps extends BulkActionProvisionResourceProps {
  initialValues: BulkActionFormData;
  repository: RepositoryView;
  canPushToConfiguredBranch: boolean;
}

function FormContent({
  initialValues,
  selectedItems,
  repository,
  canPushToConfiguredBranch,
  onDismiss,
  onJobCreated,
}: FormProps) {
  const { submitted, submit, isCreating } = useResourceJob({ repository });
  const methods = useForm<BulkActionFormData>({ defaultValues: initialValues });
  const { handleSubmit, watch, setValue, formState } = methods;

  const fallbackMessage = t('browse-dashboards.bulk-delete-resources-form.default-commit-message', 'Delete resources');
  // Bulk operations span multiple resources, so `resourceKind` is omitted and `title` is a count
  // summary rather than a single resource name.
  const templateVars: CommitTemplateVars = {
    action: 'delete',
    resourceID: '',
    title: getSelectedResourceCountSummary(selectedItems),
    ...getCurrentCommitUser(),
  };
  const { locked, message } = useCommitMessageTemplate({
    repository,
    vars: templateVars,
    comment: watch('comment') ?? '',
    isCommentDirty: Boolean(formState.dirtyFields.comment),
    setComment: (value) => setValue('comment', value, { shouldDirty: false }),
    fallbackMessage,
  });

  const handleSubmitForm = async (data: BulkActionFormData) => {
    const resources = collectSelectedItems(selectedItems);
    const workflow = getWorkflowForRef(repository, data.ref);

    const folderCount = Object.keys(selectedItems.folder || {}).length;
    const dashboardCount = Object.keys(selectedItems.dashboard || {}).length;
    reportInteraction('grafana_provisioning_bulk_delete_submitted', {
      workflow,
      repositoryName: repository.name ?? 'unknown',
      repositoryType: repository.type ?? 'unknown',
      resourceCount: resources.length,
      folderCount,
      dashboardCount,
    });

    const jobSpec: DeleteJobSpec = {
      action: 'delete',
      message,
      delete: {
        ref: getRequestRef(repository, data.ref),
        resources,
      },
    };

    try {
      await submit(jobSpec);
      onJobCreated?.();
    } catch (error) {
      getAppEvents().publish({
        type: AppEvents.alertError.name,
        payload: [
          t('browse-dashboards.bulk-delete-resources-form.error-deleting-resources', 'Error deleting resources'),
          extractErrorMessage(
            error,
            t('browse-dashboards.bulk-actions.error-generic', 'Unexpected error happened when creating job')
          ),
        ],
      });
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(handleSubmitForm)}>
        <Stack direction="column" gap={2}>
          {submitted ? (
            <ResourceJobStatus
              job={submitted.job}
              jobType="delete"
              successTitle={
                getJobRef(submitted.jobSpec)
                  ? t('provisioning.bulk-action.success-title-branch', 'Requested changes were pushed to a branch')
                  : t('browse-dashboards.bulk-delete-resources-form.success-title', 'Resources deleted successfully')
              }
            />
          ) : (
            <>
              <AffectedFolderContents
                selectedItems={selectedItems}
                defaultMessage={
                  <Trans i18nKey="browse-dashboards.bulk-delete-resources-form.delete-warning">
                    This will delete selected folders and their descendants.
                  </Trans>
                }
                emptyMessage={t('browse-dashboards.bulk-delete-resources-form.folder-empty', '', {
                  count: getSelectedUIDs(selectedItems, 'folder').length,
                  defaultValue_one: 'Selected folder is empty',
                  defaultValue_other: 'Selected folders are empty',
                })}
                nonEmptyMessage={t('browse-dashboards.bulk-delete-resources-form.folder-not-empty', '', {
                  count: getSelectedUIDs(selectedItems, 'folder').length,
                  defaultValue_one: 'Selected folder contains resources that will be deleted',
                  defaultValue_other: 'Selected folders contain resources that will be deleted',
                })}
              />
              <ResourceEditFormSharedFields
                resourceType="folder"
                isNew={false}
                canPushToConfiguredBranch={canPushToConfiguredBranch}
                repository={repository}
                hiddenFields={['path']}
                lockComment={locked}
                commitMessage={message}
              />
              <Stack gap={2}>
                <Button variant="secondary" fill="outline" onClick={onDismiss} disabled={isCreating}>
                  <Trans i18nKey="browse-dashboards.bulk-delete-resources-form.button-cancel">Cancel</Trans>
                </Button>
                <Button type="submit" disabled={isCreating} variant="destructive">
                  {isCreating
                    ? t('browse-dashboards.bulk-delete-resources-form.button-deleting', 'Deleting...')
                    : t('browse-dashboards.bulk-delete-resources-form.button-delete', 'Delete')}
                </Button>
              </Stack>
            </>
          )}
        </Stack>
      </form>
    </FormProvider>
  );
}

export function BulkDeleteProvisionedResource({
  folderUid,
  selectedItems,
  onDismiss,
  onJobCreated,
}: BulkActionProvisionResourceProps) {
  // Check if we're on the root browser dashboards page
  const isRootPage = isRootFolderUID(folderUid);
  const { selectedItemsRepoUID } = useSelectionRepoValidation(selectedItems);

  // Capture the repo UID so it survives selection state changes during/after job execution
  const resolvedRepoUID = useRef(selectedItemsRepoUID);
  if (selectedItemsRepoUID) {
    resolvedRepoUID.current = selectedItemsRepoUID;
  }

  // For root provisioned folders, the folder UID is the repository name
  const { repository, isReadOnlyRepo, isMissingRepo, isLoading, status } = useGetResourceRepositoryView({
    folderName: isRootPage ? resolvedRepoUID.current : folderUid,
  });
  const canPushToConfiguredBranch = getCanPushToConfiguredBranch(repository);
  const initialValues = getBulkActionInitialValues(repository, 'bulk-delete');

  return (
    <ProvisionedFormGate
      isLoading={isLoading}
      isOrphaned={status === RepoViewStatus.Orphaned}
      isMissingRepo={isMissingRepo}
      isReadOnly={isReadOnlyRepo}
    >
      {repository && (
        <FormContent
          selectedItems={selectedItems}
          onDismiss={onDismiss}
          onJobCreated={onJobCreated}
          initialValues={initialValues}
          repository={repository}
          canPushToConfiguredBranch={canPushToConfiguredBranch}
        />
      )}
    </ProvisionedFormGate>
  );
}
