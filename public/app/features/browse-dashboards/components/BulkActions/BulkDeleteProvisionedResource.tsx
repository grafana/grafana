import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Box, Button, Stack, Text } from '@grafana/ui';
import {
  DeleteRepositoryFilesWithPathApiArg,
  DeleteRepositoryFilesWithPathApiResponse,
  Job,
  RepositoryView,
  useDeleteRepositoryFilesWithPathMutation,
  useListJobQuery,
} from 'app/api/clients/provisioning/v0alpha1';
import { extractErrorMessage } from 'app/api/utils';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import { ResourceEditFormSharedFields } from 'app/features/dashboard-scene/components/Provisioned/ResourceEditFormSharedFields';
import { getDefaultWorkflow, getWorkflowOptions } from 'app/features/dashboard-scene/saving/provisioned/defaults';
import { generateTimestamp } from 'app/features/dashboard-scene/saving/provisioned/utils/timestamp';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { useSelector } from 'app/types/store';

import { useChildrenByParentUIDState, rootItemsSelector } from '../../state/hooks';
import { findItem } from '../../state/utils';
import { DescendantCount } from '../BrowseActions/DescendantCount';
import { collectSelectedItems, fetchProvisionedDashboardPath } from '../utils';

import { MoveResultFailed } from './BulkActionFailureBanner';
import { BulkActionPostSubmitStep } from './BulkActionPostSubmitStep';
import { ProgressState } from './BulkActionProgress';
import { useBulkActionRequest } from './useBulkActionRequest';
import {
  BulkActionFormData,
  BulkActionProvisionResourceProps,
  BulkSuccessResponse,
  MoveResultSuccessState,
} from './utils';
import { DeleteJobSpec, ResourceRef, useBulkActionJob } from './useBulkActionJob';
import { JobStatus } from 'app/features/provisioning/Job/JobStatus';
import ProgressBar from 'app/features/provisioning/Shared/ProgressBar';

interface FormProps extends BulkActionProvisionResourceProps {
  initialValues: BulkActionFormData;
  repository: RepositoryView;
  workflowOptions: Array<{ label: string; value: string }>;
  folderPath?: string;
}

function FormContent({ initialValues, selectedItems, repository, workflowOptions, folderPath, onDismiss }: FormProps) {
  // States
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [job, setJob] = useState<Job>();
  const [failureResults, setFailureResults] = useState<MoveResultFailed[] | undefined>();
  const [successState, setSuccessState] = useState<MoveResultSuccessState>({
    allSuccess: false,
    repoUrl: '',
  });
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Hooks
  const { createBulkJob, isLoading: isCreatingJob } = useBulkActionJob();
  const [deleteRepoFile, request] = useDeleteRepositoryFilesWithPathMutation();
  const methods = useForm<BulkActionFormData>({ defaultValues: initialValues });
  const childrenByParentUID = useChildrenByParentUIDState();
  const rootItems = useSelector(rootItemsSelector);
  const { handleSubmit, watch } = methods;
  const workflow = watch('workflow');
  const { handleSuccess } = useBulkActionRequest({ workflow, repository, successState, onDismiss });

  const handleSubmitForm = async (data: BulkActionFormData) => {
    setFailureResults(undefined);
    setHasSubmitted(true);

    const targets = collectSelectedItems(selectedItems, childrenByParentUID, rootItems?.items || []);
    const resources: ResourceRef[] = targets.map(({ uid, isFolder }) => ({
      name: uid,
      group: isFolder ? 'folder.grafana.app' : 'dashboard.grafana.app',
      kind: isFolder ? 'Folder' : 'Dashboard',
    }));
    // Create the delete job spec
    const jobSpec: DeleteJobSpec = {
      action: 'delete',
      delete: {
        // ref: data.workflow === 'write' ? undefined : data.ref,
        resources,
      },
    };

    console.log('🔧 Repository type:', repository.type);
    console.log('🔧 Workflow:', data.workflow);

    // Use the hook to create the job
    console.log('🚀 Creating bulk delete job with spec:', jobSpec);
    const result = await createBulkJob(repository, jobSpec);
    console.log('📦 Job creation result:', result);

    if (result.success && result.job) {
      console.log('✅ Job created successfully:', {
        jobId: result.jobId,
        jobName: result.job.metadata?.name,
        jobStatus: result.job.status,
        initialState: result.job.status?.state,
      });
      setJob(result.job); // Store the job for tracking
    } else {
      console.error('❌ Job creation failed:', result.error);
      setFailureResults([
        {
          status: 'failed',
          title: 'Bulk Delete Job Failed',
          errorMessage: result.error || 'Unknown error',
        },
      ]);
    }
  };

  // Monitor job status for completion
  const jobQuery = useListJobQuery(
    {
      fieldSelector: `metadata.name=${job?.metadata?.name}`,
      watch: true,
    },
    { skip: !job } // Only run query when we have a job
  );

  // Get the current job status
  const currentJob = jobQuery?.data?.items?.[0];
  const jobStatus = currentJob?.status;
  const jobState = jobStatus?.state;

  // If job is created, display the job status with live updates
  if (job && hasSubmitted) {
    console.log('🔄 Current job progress:', job?.status?.progress);
    console.log('🔄 Current job state:', jobState);
    console.log('📊 Job status:', jobStatus);
    console.log('🔍 Full current job:', currentJob);

    return (
      <Stack direction="column" gap={2}>
        <ProgressBar progress={jobStatus?.progress ?? 0} />
      </Stack>
    );
  }

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

          {hasSubmitted ? (
            <BulkActionPostSubmitStep
              action="delete"
              progress={progress}
              successState={successState}
              failureResults={failureResults}
              handleSuccess={handleSuccess}
              setFailureResults={setFailureResults}
            />
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
                <Button type="submit" disabled={request.isLoading || !!failureResults} variant="destructive">
                  {request.isLoading
                    ? t('browse-dashboards.bulk-delete-resources-form.button-deleting', 'Deleting...')
                    : t('browse-dashboards.bulk-delete-resources-form.button-delete', 'Delete')}
                </Button>
                <Button variant="secondary" fill="outline" onClick={onDismiss} disabled={request.isLoading}>
                  <Trans i18nKey="browse-dashboards.bulk-delete-resources-form.button-cancel">Cancel</Trans>
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
  const { repository, folder } = useGetResourceRepositoryView({ folderName: folderUid });

  const workflowOptions = getWorkflowOptions(repository);
  const folderPath = folder?.metadata?.annotations?.[AnnoKeySourcePath] || '';
  const timestamp = generateTimestamp();

  const initialValues = {
    comment: '',
    ref: `bulk-delete/${timestamp}`,
    workflow: getDefaultWorkflow(repository),
  };

  if (!repository) {
    return null;
  }

  return (
    <FormContent
      selectedItems={selectedItems}
      onDismiss={onDismiss}
      initialValues={initialValues}
      repository={repository}
      workflowOptions={workflowOptions}
      folderPath={folderPath}
    />
  );
}
