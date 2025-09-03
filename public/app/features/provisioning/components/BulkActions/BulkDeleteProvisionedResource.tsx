import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Box, Button, Stack } from '@grafana/ui';
import { Job, RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { DescendantCount } from 'app/features/browse-dashboards/components/BrowseActions/DescendantCount';
import { collectSelectedItems } from 'app/features/browse-dashboards/components/utils';
import { JobStatus } from 'app/features/provisioning/Job/JobStatus';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';

import { useSelectionRepoValidation } from '../../hooks/useSelectionRepoValidation';
import { RepoInvalidStateBanner } from '../Shared/RepoInvalidStateBanner';
import { ResourceEditFormSharedFields } from '../Shared/ResourceEditFormSharedFields';
import { getDefaultWorkflow, getWorkflowOptions } from '../defaults';
import { generateTimestamp } from '../utils/timestamp';

import { DeleteJobSpec, useBulkActionJob } from './useBulkActionJob';
import { BulkActionFormData, BulkActionProvisionResourceProps } from './utils';

interface FormProps extends BulkActionProvisionResourceProps {
  initialValues: BulkActionFormData;
  repository: RepositoryView;
  workflowOptions: Array<{ label: string; value: string }>;
}

function FormContent({ initialValues, selectedItems, repository, workflowOptions, onDismiss }: FormProps) {
  // States
  const [job, setJob] = useState<Job>();
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Hooks
  const { createBulkJob, isLoading: isCreatingJob } = useBulkActionJob();
  const methods = useForm<BulkActionFormData>({ defaultValues: initialValues });
  const { handleSubmit, watch } = methods;
  const workflow = watch('workflow');

  const handleSubmitForm = async (data: BulkActionFormData) => {
    setHasSubmitted(true);

    const resources = collectSelectedItems(selectedItems);

    // Create the delete job spec
    const jobSpec: DeleteJobSpec = {
      action: 'delete',
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
          <Box paddingBottom={2}>
            <Trans i18nKey="browse-dashboards.bulk-delete-resources-form.delete-warning">
              This will delete selected folders and their descendants. In total, this will affect:
            </Trans>
            <DescendantCount selectedItems={{ ...selectedItems, panel: {}, $all: false }} />
          </Box>

          {hasSubmitted && job ? (
            <JobStatus watch={job} jobType="delete" />
          ) : (
            <>
              <ResourceEditFormSharedFields
                resourceType="folder"
                isNew={false}
                workflow={workflow}
                workflowOptions={workflowOptions}
                repository={repository}
                hidePath
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
  const isRootPage = !folderUid || folderUid === GENERAL_FOLDER_UID;
  const { selectedItemsRepoUID } = useSelectionRepoValidation(selectedItems);

  // For root provisioned folders, the folder UID is the repository name
  const { repository, isReadOnlyRepo } = useGetResourceRepositoryView({
    folderName: isRootPage ? selectedItemsRepoUID : folderUid,
  });
  const workflowOptions = getWorkflowOptions(repository);
  const timestamp = generateTimestamp();

  const initialValues = {
    comment: '',
    ref: `bulk-delete/${timestamp}`,
    workflow: getDefaultWorkflow(repository),
  };

  if (!repository || isReadOnlyRepo) {
    return <RepoInvalidStateBanner noRepository={!repository} isReadOnlyRepo={isReadOnlyRepo} />;
  }

  return (
    <FormContent
      selectedItems={selectedItems}
      onDismiss={onDismiss}
      initialValues={initialValues}
      repository={repository}
      workflowOptions={workflowOptions}
    />
  );
}
