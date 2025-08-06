import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Box, Button, Stack } from '@grafana/ui';
import { Job, RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import { ResourceEditFormSharedFields } from 'app/features/dashboard-scene/components/Provisioned/ResourceEditFormSharedFields';
import { getDefaultWorkflow, getWorkflowOptions } from 'app/features/dashboard-scene/saving/provisioned/defaults';
import { generateTimestamp } from 'app/features/dashboard-scene/saving/provisioned/utils/timestamp';
import { JobStatus } from 'app/features/provisioning/Job/JobStatus';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { useSelector } from 'app/types/store';

import { useChildrenByParentUIDState, rootItemsSelector } from '../../state/hooks';
import { DescendantCount } from '../BrowseActions/DescendantCount';
import { collectSelectedItems } from '../utils';

import { DeleteJobSpec, ResourceRef, useBulkActionJob } from './useBulkActionJob';
import { BulkActionFormData, BulkActionProvisionResourceProps } from './utils';

interface FormProps extends BulkActionProvisionResourceProps {
  initialValues: BulkActionFormData;
  repository: RepositoryView;
  workflowOptions: Array<{ label: string; value: string }>;
  folderPath?: string;
}

function FormContent({ initialValues, selectedItems, repository, workflowOptions, folderPath, onDismiss }: FormProps) {
  // States
  const [job, setJob] = useState<Job>();
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Hooks
  const { createBulkJob, isLoading: isCreatingJob } = useBulkActionJob();
  const methods = useForm<BulkActionFormData>({ defaultValues: initialValues });
  const childrenByParentUID = useChildrenByParentUIDState();
  const rootItems = useSelector(rootItemsSelector);
  const { handleSubmit, watch } = methods;
  const workflow = watch('workflow');

  const handleSubmitForm = async (data: BulkActionFormData) => {
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

  const handleFinish = () => {
    onDismiss?.();
  };

  const disableBtn = isCreatingJob || job?.status?.state === 'working' || job?.status?.state === 'pending';

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
            <>
              <JobStatus watch={job} jobType="delete" />
              <Button onClick={handleFinish}>
                <Trans i18nKey="browse-dashboards.bulk-delete-resources-form.button-done">Done</Trans>
              </Button>
            </>
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
                <Button type="submit" disabled={disableBtn} variant="destructive">
                  {job?.status?.state === 'working' || job?.status?.state === 'pending'
                    ? t('browse-dashboards.bulk-delete-resources-form.button-deleting', 'Deleting...')
                    : t('browse-dashboards.bulk-delete-resources-form.button-delete', 'Delete')}
                </Button>
                <Button variant="secondary" fill="outline" onClick={onDismiss} disabled={disableBtn}>
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
