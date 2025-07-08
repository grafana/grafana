import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Box, Button, Stack } from '@grafana/ui';
import { Folder } from 'app/api/clients/folder/v1beta1';
import {
  DeleteRepositoryFilesWithPathApiArg,
  RepositoryView,
  useDeleteRepositoryFilesWithPathMutation,
} from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import { ResourceEditFormSharedFields } from 'app/features/dashboard-scene/components/Provisioned/ResourceEditFormSharedFields';
import { getDefaultWorkflow, getWorkflowOptions } from 'app/features/dashboard-scene/saving/provisioned/defaults';
import { useDefaultValues } from 'app/features/dashboard-scene/saving/provisioned/hooks';
import { BaseProvisionedFormData } from 'app/features/dashboard-scene/saving/shared';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { WorkflowOption } from 'app/features/provisioning/types';

import { useProvisionedFolderFormData } from '../hooks/useProvisionedFolderFormData';
import { DashboardTreeSelection } from '../types';

import { DescendantCount } from './BrowseActions/DescendantCount';
import { getFolderURL } from './utils';

interface BulkDeleteFormData {
  comment: string;
  ref: string;
  workflow?: WorkflowOption;
}

interface FormProps extends BulkDeleteProvisionResourceProps {
  initialValues: BulkDeleteFormData;
  repository?: RepositoryView;
  workflowOptions: Array<{ label: string; value: string }>;
  isGitHub: boolean;
  folderPath?: string;
}

interface BulkDeleteProvisionResourceProps {
  folderUid?: string;
  selectedItems: DashboardTreeSelection;
  onDismiss?: () => void;
}

function FormContent({
  initialValues,
  selectedItems,
  repository,
  workflowOptions,
  folderPath,
  isGitHub,
  onDismiss,
}: FormProps) {
  //   const resourceId = parentFolder?.uid || '';

  const [deleteRepoFile, request] = useDeleteRepositoryFilesWithPathMutation();

  const methods = useForm<BulkDeleteFormData>({ defaultValues: initialValues });
  const { handleSubmit, watch } = methods;
  const workflow = watch('workflow');

  const handleSubmitForm = async (data: BulkDeleteFormData) => {
    if (!repository) {
      console.error('No repository found');
      return;
    }

    const buildDeleteParams = (
      items: Record<string, boolean | undefined>,
      isFolder: boolean
    ): DeleteRepositoryFilesWithPathApiArg[] =>
      Object.keys(items).map((key) => ({
        name: repository.name,
        path: `${folderPath}/${key}${isFolder ? '/' : ''}`,
        ref: workflow === 'write' ? undefined : data.ref,
        message: data.comment,
      }));

    const deleteRequests = [
      ...buildDeleteParams(selectedItems.folder, true),
      ...buildDeleteParams(selectedItems.dashboard, false),
    ];

    try {
      const results = await Promise.allSettled(deleteRequests.map((params) => deleteRepoFile(params).unwrap()));

      const successes = [];
      const failures = [];

      results.forEach((result, index) => {
        const item = deleteRequests[index];
        if (result.status === 'fulfilled') {
          successes.push({ index, item, data: result.value });
        } else {
          failures.push({ index, item, error: result.reason });
        }
      });

      if (successes.length > 0) {
        console.log('Successes:', successes);
        getAppEvents().publish({
          type: AppEvents.alertSuccess.name,
          payload: [
            t(
              'browse-dashboard.bulk-delete-resources-form.api-success',
              `Successfully deleted ${successes.length} items`
            ),
          ],
        });
      }

      if (failures.length > 0) {
        console.error('Failures:', failures);
        getAppEvents().publish({
          type: AppEvents.alertError.name,
          payload: [
            t('browse-dashboard.bulk-delete-resources-form.api-error', `Failed to delete ${failures.length} items`),
            failures.map((f) => `${f.item.path}`).join('\n'),
          ],
        });
      }
    } catch (error) {
      getAppEvents().publish({
        type: AppEvents.alertError.name,
        payload: [
          t(
            'browse-dashboard.bulk-delete-resources-form.api-error',
            `Bulk delete failed: ${(error as Error).message || error}`
          ),
        ],
      });
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(handleSubmitForm)}>
        <Stack direction="column" gap={2}>
          <Box paddingBottom={2}>
            <Trans i18nKey="browse-dashboards.delete-provisioned-folder-form.delete-warning">
              This will delete selected folders and their descendants. In total, this will affect:
            </Trans>
            <DescendantCount selectedItems={selectedItems} />
          </Box>

          <ResourceEditFormSharedFields
            resourceType="folder"
            isNew={false}
            workflow={workflow}
            workflowOptions={workflowOptions}
            isGitHub={isGitHub}
            hidePath
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

export function BulkDeleteProvisionedResource({
  folderUid,
  selectedItems,
  onDismiss,
}: BulkDeleteProvisionResourceProps) {
  // const { workflowOptions, isGitHub, repository, folder, initialValues } = useProvisionedFolderFormData({
  //   folderUid: parentFolder?.uid,
  //   action: 'delete',
  //   title: parentFolder?.title,
  // });
  const { repository, folder } = useGetResourceRepositoryView({ folderName: folderUid });
  console.log('folderUid', folderUid);
  console.log('repository', repository, folder);

  const workflowOptions = getWorkflowOptions(repository);
  const isGitHub = repository?.type === 'github';
  const folderPath = folder?.metadata?.annotations?.[AnnoKeySourcePath] || '';

  //   if (!initialValues) {
  //     return null;
  //   }
  const initialValues = {
    comment: '',
    ref: '',
    workflow: getDefaultWorkflow(repository),
  };

  return (
    <FormContent
      selectedItems={selectedItems}
      onDismiss={onDismiss}
      initialValues={initialValues}
      repository={repository}
      workflowOptions={workflowOptions}
      isGitHub={isGitHub}
      folderPath={folderPath}
    />
  );
}
