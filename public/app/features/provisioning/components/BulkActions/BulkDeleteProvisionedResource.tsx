import { useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents, reportInteraction } from '@grafana/runtime';
import { Button, Stack } from '@grafana/ui';
import { type Job, type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { AffectedFolderContents } from 'app/features/browse-dashboards/components/BrowseActions/AffectedFolderContents';
import { getSelectedFolderUIDs } from 'app/features/browse-dashboards/components/BrowseActions/utils';
import { collectSelectedItems } from 'app/features/browse-dashboards/utils/dashboards';
import {
  RepoViewStatus,
  useGetResourceRepositoryView,
} from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { isRootFolderUID } from 'app/features/search/constants';

import { useSelectionRepoValidation } from '../../hooks/useSelectionRepoValidation';
import { withSavedByTrailer } from '../../utils/currentUser';
import { ProvisionedFormGate } from '../ProvisionedFormGate';
import { ResourceEditFormSharedFields } from '../Shared/ResourceEditFormSharedFields';
import { getCanPushToConfiguredBranch } from '../defaults';

import { BulkActionJobStatus } from './BulkActionJobStatus';
import { type DeleteJobSpec, useBulkActionJob } from './useBulkActionJob';
import { type BulkActionFormData, type BulkActionProvisionResourceProps, getBulkActionInitialValues } from './utils';

interface FormProps extends BulkActionProvisionResourceProps {
  initialValues: BulkActionFormData;
  repository: RepositoryView;
  canPushToConfiguredBranch: boolean;
}

function FormContent({ initialValues, selectedItems, repository, canPushToConfiguredBranch, onDismiss }: FormProps) {
  // States
  const [job, setJob] = useState<Job>();
  const [hasSubmitted, setHasSubmitted] = useState(false);
  // Captured at submit time so the success message matches the workflow the job used.
  const submittedViaBranchWorkflow = useRef(false);

  // Hooks
  const { createBulkJob, isLoading: isCreatingJob } = useBulkActionJob();
  const methods = useForm<BulkActionFormData>({ defaultValues: initialValues });
  const { handleSubmit } = methods;

  const handleSubmitForm = async (data: BulkActionFormData) => {
    setHasSubmitted(true);

    const resources = collectSelectedItems(selectedItems);

    const folderCount = Object.keys(selectedItems.folder || {}).length;
    const dashboardCount = Object.keys(selectedItems.dashboard || {}).length;
    reportInteraction('grafana_provisioning_bulk_delete_submitted', {
      workflow: data.workflow,
      repositoryName: repository.name ?? 'unknown',
      repositoryType: repository.type ?? 'unknown',
      resourceCount: resources.length,
      folderCount,
      dashboardCount,
    });

    submittedViaBranchWorkflow.current = data.workflow === 'branch';

    // Create the delete job spec. The Grafana-saved-by trailer rides through
    // JobSpec.Message to the resulting git commit.
    const jobSpec: DeleteJobSpec = {
      action: 'delete',
      message: withSavedByTrailer(
        data.comment?.trim() ||
          t('browse-dashboards.bulk-delete-resources-form.default-commit-message', 'Delete resources')
      ),
      delete: {
        ref: data.workflow === 'write' ? undefined : data.ref,
        resources,
      },
    };

    const result = await createBulkJob(repository, jobSpec);

    if (result.success && result.job) {
      setJob(result.job); // Store the job for tracking
    } else if (!result.success && result.error) {
      // Handle error case - show error alert
      getAppEvents().publish({
        type: AppEvents.alertError.name,
        payload: [
          t('browse-dashboards.bulk-delete-resources-form.error-deleting-resources', 'Error deleting resources'),
          result.error,
        ],
      });
      setHasSubmitted(false); // Reset submit state so user can try again
    }
  };

  const disableBtn =
    isCreatingJob || job?.status?.state === 'working' || job?.status?.state === 'pending' || hasSubmitted;

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(handleSubmitForm)}>
        <Stack direction="column" gap={2}>
          {hasSubmitted && job ? (
            <BulkActionJobStatus
              job={job}
              jobType="delete"
              successTitle={
                submittedViaBranchWorkflow.current
                  ? t(
                      'browse-dashboards.bulk-delete-resources-form.success-title-branch',
                      'Requested changes were pushed to a branch'
                    )
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
                  count: getSelectedFolderUIDs(selectedItems).length,
                  defaultValue_one: 'Selected folder is empty',
                  defaultValue_other: 'Selected folders are empty',
                })}
                nonEmptyMessage={t('browse-dashboards.bulk-delete-resources-form.folder-not-empty', '', {
                  count: getSelectedFolderUIDs(selectedItems).length,
                  defaultValue_one: 'Selected folder contains other resources that will be deleted',
                  defaultValue_other: 'Selected folders contain other resources that will be deleted',
                })}
              />
              <ResourceEditFormSharedFields
                resourceType="folder"
                isNew={false}
                canPushToConfiguredBranch={canPushToConfiguredBranch}
                repository={repository}
                hiddenFields={['path']}
              />
              <Stack gap={2}>
                <Button variant="secondary" fill="outline" onClick={onDismiss} disabled={isCreatingJob}>
                  <Trans i18nKey="browse-dashboards.bulk-delete-resources-form.button-cancel">Cancel</Trans>
                </Button>
                <Button type="submit" disabled={disableBtn} variant="destructive">
                  {job?.status?.state === 'working' || job?.status?.state === 'pending'
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
          initialValues={initialValues}
          repository={repository}
          canPushToConfiguredBranch={canPushToConfiguredBranch}
        />
      )}
    </ProvisionedFormGate>
  );
}
