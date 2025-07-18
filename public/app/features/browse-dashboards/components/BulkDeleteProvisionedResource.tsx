import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Box, Button, Stack } from '@grafana/ui';
import {
  DeleteRepositoryFilesWithPathApiArg,
  DeleteRepositoryFilesWithPathApiResponse,
  RepositoryView,
  useDeleteRepositoryFilesWithPathMutation,
} from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import { ResourceEditFormSharedFields } from 'app/features/dashboard-scene/components/Provisioned/ResourceEditFormSharedFields';
import { getDefaultWorkflow, getWorkflowOptions } from 'app/features/dashboard-scene/saving/provisioned/defaults';
import { generateTimestamp } from 'app/features/dashboard-scene/saving/provisioned/utils/timestamp';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { WorkflowOption } from 'app/features/provisioning/types';

import { useChildrenByParentUIDState } from '../state/hooks';
import { findItem } from '../state/utils';
import { DashboardTreeSelection } from '../types';

import { DescendantCount } from './BrowseActions/DescendantCount';
import { BulkActionFailureBanner, MoveResultFailed } from './BulkActionFailureBanner';
import { BulkActionProgress, ProgressState } from './BulkActionProgress';
import { extractErrorMessage, fetchProvisionedDashboardPath } from './utils';

interface BulkDeleteFormData {
  comment: string;
  ref: string;
  workflow?: WorkflowOption;
}

interface FormProps extends BulkDeleteProvisionResourceProps {
  initialValues: BulkDeleteFormData;
  repository: RepositoryView;
  workflowOptions: Array<{ label: string; value: string }>;
  isGitHub: boolean;
  folderPath?: string;
}

interface BulkDeleteProvisionResourceProps {
  folderUid?: string;
  selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>;
  onDismiss?: () => void;
}

type BulkSuccessResponse = Array<{
  index: number;
  item: DeleteRepositoryFilesWithPathApiArg;
  data: DeleteRepositoryFilesWithPathApiResponse;
}>;

function updateProgress(
  index: number,
  total: number,
  title: string | undefined,
  setProgress: React.Dispatch<React.SetStateAction<ProgressState | null>>
) {
  setProgress({
    current: index,
    total,
    item: title || 'Unknown',
  });
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
  const [deleteRepoFile, request] = useDeleteRepositoryFilesWithPathMutation();
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [failureResults, setFailureResults] = useState<MoveResultFailed[] | undefined>();

  const methods = useForm<BulkDeleteFormData>({ defaultValues: initialValues });
  const childrenByParentUID = useChildrenByParentUIDState();
  const { handleSubmit, watch } = methods;
  const workflow = watch('workflow');
  const navigate = useNavigate();

  const getResourcePath = async (uid: string, isFolder: boolean): Promise<string | undefined> => {
    const item = findItem([], childrenByParentUID, uid);
    if (!item) {
      return undefined;
    }
    return isFolder ? `${folderPath}/${item.title}/` : fetchProvisionedDashboardPath(uid);
  };

  const handleSuccess = (successes: BulkSuccessResponse) => {
    getAppEvents().publish({
      type: AppEvents.alertSuccess.name,
      payload: [
        t('browse-dashboard.bulk-delete-resources-form.api-success', `Successfully deleted ${successes.length} items`),
      ],
    });

    if (workflow === 'branch') {
      onDismiss?.();
      const prUrl = successes[0].data.urls?.newPullRequestURL;
      if (prUrl) {
        navigate({ search: `?new_pull_request_url=${encodeURIComponent(prUrl)}` });
        return;
      }
      window.location.reload();
    } else {
      onDismiss?.();
      window.location.reload();
    }
  };

  const handleSubmitForm = async (data: BulkDeleteFormData) => {
    setFailureResults(undefined);

    const targets = collectSelectedItems(selectedItems, childrenByParentUID);

    if (targets.length > 0) {
      updateProgress(0, targets.length, targets[0].displayName, setProgress);
    }

    const successes: BulkSuccessResponse = [];
    const failures: MoveResultFailed[] = [];

    // Iterate through each selected item and delete it
    // We want sequential processing to avoid overwhelming the API
    for (let i = 0; i < targets.length; i++) {
      const { uid, isFolder, displayName } = targets[i];
      updateProgress(i, targets.length, displayName, setProgress);

      try {
        // get path in repository
        const path = await getResourcePath(uid, isFolder);
        if (!path) {
          failures.push({
            status: 'failed',
            title: `${isFolder ? 'Folder' : 'Dashboard'}: ${displayName}`,
            errorMessage: 'Path not found - item may not be provisioned',
          });
          continue;
        }

        // build params
        const deleteParams: DeleteRepositoryFilesWithPathApiArg = {
          name: repository.name,
          path,
          ref: workflow === 'write' ? undefined : data.ref,
          message: data.comment || `Delete resource ${path}`,
        };

        // perform delete operation
        const response = await deleteRepoFile(deleteParams).unwrap();
        successes.push({ index: i, item: deleteParams, data: response });
      } catch (error: unknown) {
        failures.push({
          status: 'failed',
          title: `${isFolder ? 'Folder' : 'Dashboard'}: ${displayName}`,
          errorMessage: extractErrorMessage(error),
        });
      }

      updateProgress(i + 1, targets.length, targets[i + 1]?.displayName, setProgress);
    }

    setProgress(null);

    if (successes.length > 0 && failures.length === 0) {
      handleSuccess(successes);
    } else if (failures.length > 0) {
      setFailureResults(failures);
    }
  };

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

          {failureResults && (
            <BulkActionFailureBanner result={failureResults} onDismiss={() => setFailureResults(undefined)} />
          )}

          {progress && <BulkActionProgress progress={progress} />}

          <ResourceEditFormSharedFields
            resourceType="folder"
            isNew={false}
            workflow={workflow}
            workflowOptions={workflowOptions}
            isGitHub={isGitHub}
            hidePath
          />

          <Stack gap={2}>
            <Button type="submit" disabled={request.isLoading || !!failureResults} variant="destructive">
              {request.isLoading
                ? t('browse-dashboards.bulk-delete-resources-form.button-deleting', 'Deleting...')
                : t('browse-dashboards.bulk-delete-resources-form.button-delete', 'Delete')}
            </Button>
            <Button variant="secondary" fill="outline" onClick={onDismiss}>
              <Trans i18nKey="browse-dashboards.bulk-delete-resources-form.button-cancel">Cancel</Trans>
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
  const { repository, folder } = useGetResourceRepositoryView({ folderName: folderUid });

  const workflowOptions = getWorkflowOptions(repository);
  const isGitHub = repository?.type === 'github';
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
      isGitHub={isGitHub}
      folderPath={folderPath}
    />
  );
}

// Collect selected dashboard and folder from the DashboardTreeSelection
// This is used to prepare the items for bulk delete operation.
function collectSelectedItems(
  selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>,
  childrenByParentUID: ReturnType<typeof useChildrenByParentUIDState>
) {
  const targets: Array<{ uid: string; isFolder: boolean; displayName: string }> = [];

  // folders
  for (const [uid, selected] of Object.entries(selectedItems.folder)) {
    if (selected) {
      const item = findItem([], childrenByParentUID, uid);
      targets.push({ uid, isFolder: true, displayName: item?.title || uid });
    }
  }

  // dashboards
  for (const [uid, selected] of Object.entries(selectedItems.dashboard)) {
    if (selected) {
      const item = findItem([], childrenByParentUID, uid);
      targets.push({ uid, isFolder: false, displayName: item?.title || uid });
    }
  }

  return targets;
}
