import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Box, Button, Stack } from '@grafana/ui';
import {
  DeleteRepositoryFilesWithPathApiArg,
  DeleteRepositoryFilesWithPathApiResponse,
  RepositoryView,
  useDeleteRepositoryFilesWithPathMutation,
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

interface FormProps extends BulkActionProvisionResourceProps {
  initialValues: BulkActionFormData;
  repository: RepositoryView;
  workflowOptions: Array<{ label: string; value: string }>;
  folderPath?: string;
}

function FormContent({ initialValues, selectedItems, repository, workflowOptions, folderPath, onDismiss }: FormProps) {
  // States
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [failureResults, setFailureResults] = useState<MoveResultFailed[] | undefined>();
  const [successState, setSuccessState] = useState<MoveResultSuccessState>({
    allSuccess: false,
    repoUrl: '',
  });
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Hooks
  const [deleteRepoFile, request] = useDeleteRepositoryFilesWithPathMutation();
  const methods = useForm<BulkActionFormData>({ defaultValues: initialValues });
  const childrenByParentUID = useChildrenByParentUIDState();
  const rootItems = useSelector(rootItemsSelector);
  const { handleSubmit, watch } = methods;
  const workflow = watch('workflow');
  const { handleSuccess } = useBulkActionRequest({ workflow, repository, successState, onDismiss });

  const getResourcePath = async (uid: string, isFolder: boolean): Promise<string | undefined> => {
    const item = findItem(rootItems?.items || [], childrenByParentUID, uid);
    if (!item) {
      return undefined;
    }
    return isFolder ? `${folderPath}/${item.title}/` : fetchProvisionedDashboardPath(uid);
  };

  const handleSubmitForm = async (data: BulkActionFormData) => {
    setFailureResults(undefined);
    setHasSubmitted(true);

    const targets = collectSelectedItems(selectedItems, childrenByParentUID, rootItems?.items || []);

    if (targets.length > 0) {
      setProgress({
        current: 0,
        total: targets.length,
        item: targets[0].displayName || 'Unknown',
      });
    }

    const successes: BulkSuccessResponse<
      DeleteRepositoryFilesWithPathApiArg,
      DeleteRepositoryFilesWithPathApiResponse
    > = [];
    const failures: MoveResultFailed[] = [];

    // Iterate through each selected item and delete it
    // We want sequential processing to avoid overwhelming the API
    for (let i = 0; i < targets.length; i++) {
      const { uid, isFolder, displayName } = targets[i];
      setProgress({
        current: i,
        total: targets.length,
        item: displayName,
      });

      try {
        // get path in repository
        const path = await getResourcePath(uid, isFolder);
        if (!path) {
          failures.push({
            status: 'failed',
            title: `${isFolder ? 'Folder' : 'Dashboard'}: ${displayName}`,
            errorMessage: t('browse-dashboards.bulk-delete-resources-form.error-path-not-found', 'Path not found'),
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

      setProgress({
        current: i + 1,
        total: targets.length,
        item: targets[i + 1]?.displayName,
      });
    }

    setProgress(null);

    if (successes.length > 0 && failures.length === 0) {
      // handleSuccess(successes);
      setSuccessState({
        allSuccess: true,
        repoUrl: successes[0].data.urls?.repositoryURL,
      });
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
