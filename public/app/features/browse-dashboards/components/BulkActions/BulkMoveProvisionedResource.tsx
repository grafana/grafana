import { skipToken } from '@reduxjs/toolkit/query';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { FolderPicker } from '@grafana/runtime';
import { Box, Button, Field, Stack } from '@grafana/ui';
import { useGetFolderQuery } from 'app/api/clients/folder/v1beta1';
import {
  CreateRepositoryFilesWithPathApiArg,
  CreateRepositoryFilesWithPathApiResponse,
  RepositoryView,
  useCreateRepositoryFilesWithPathMutation,
  ResourceWrapper,
} from 'app/api/clients/provisioning/v0alpha1';
import { extractErrorMessage } from 'app/api/utils';
import { ScopedResourceClient } from 'app/features/apiserver/client';
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
  getTargetFolderPathInRepo,
  getResourceTargetPath,
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
  const [targetFolderUID, setTargetFolderUID] = useState<string | undefined>(undefined);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [failureResults, setFailureResults] = useState<MoveResultFailed[] | undefined>();
  const [successState, setSuccessState] = useState<MoveResultSuccessState>({
    allSuccess: false,
    repoUrl: '',
  });
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Hooks
  const [moveFile, moveRequest] = useCreateRepositoryFilesWithPathMutation();
  const methods = useForm<BulkActionFormData>({ defaultValues: initialValues });
  const childrenByParentUID = useChildrenByParentUIDState();
  const rootItems = useSelector(rootItemsSelector);
  const { handleSubmit, watch } = methods;
  const workflow = watch('workflow');
  const { handleSuccess } = useBulkActionRequest({ workflow, repository, successState, onDismiss });

  // Get target folder data
  const { data: targetFolder } = useGetFolderQuery(targetFolderUID ? { name: targetFolderUID } : skipToken);

  const getResourceCurrentPath = async (uid: string, isFolder: boolean): Promise<string | undefined> => {
    const item = findItem(rootItems?.items || [], childrenByParentUID, uid);
    if (!item) {
      return undefined;
    }
    return isFolder ? `${folderPath}/${item.title}/` : fetchProvisionedDashboardPath(uid);
  };

  const getDashboardBody = async (currentPath: string) => {
    const repositoryClient = new ScopedResourceClient({
      group: 'provisioning.grafana.app',
      version: 'v0alpha1',
      resource: 'repositories',
    });
    const fileResponse = await repositoryClient.subresource<ResourceWrapper>(repository.name, `files/${currentPath}`);
    return fileResponse.resource?.file;
  };

  const setupMoveOperation = () => {
    const targetFolderPathInRepo = getTargetFolderPathInRepo({ targetFolder });
    const targets = collectSelectedItems(selectedItems, childrenByParentUID, rootItems?.items || []);

    if (targets.length > 0) {
      setProgress({
        current: 0,
        total: targets.length,
        item: targets[0].displayName || 'Unknown',
      });
    }

    return { targetFolderPathInRepo, targets };
  };

  const createFileBody = async (isFolder: boolean, displayName: string, currentPath: string) => {
    if (isFolder) {
      return {
        title: displayName,
        type: 'folder',
      };
    }

    const fileBody = await getDashboardBody(currentPath);
    if (!fileBody) {
      throw new Error(
        t('browse-dashboards.bulk-move-resources-form.error-file-content-not-found', 'File content not found')
      );
    }

    return fileBody;
  };

  const handleSubmitForm = async (data: BulkActionFormData) => {
    setFailureResults(undefined);
    setHasSubmitted(true);

    // 1. Validate
    if (!targetFolder) {
      setFailureResults([
        {
          status: 'failed',
          title: t('browse-dashboards.bulk-move-resources-form.error-title', 'Target Folder Error'),
        },
      ]);
      return;
    }

    // 2. Setup
    const { targetFolderPathInRepo, targets } = setupMoveOperation();

    // 3. Process items
    const successes: BulkSuccessResponse<
      CreateRepositoryFilesWithPathApiArg,
      CreateRepositoryFilesWithPathApiResponse
    > = [];
    const failures: MoveResultFailed[] = [];

    // Iterate through each selected item and move it
    // We want sequential processing to avoid overwhelming the API
    for (let i = 0; i < targets.length; i++) {
      const { uid, isFolder, displayName } = targets[i];
      setProgress({
        current: i,
        total: targets.length,
        item: displayName,
      });

      try {
        // 1. Get source path in repository
        const currentPath = await getResourceCurrentPath(uid, isFolder);
        if (!currentPath) {
          failures.push({
            status: 'failed',
            title: `${isFolder ? 'Folder' : 'Dashboard'}: ${displayName}`,
            errorMessage: t('browse-dashboards.bulk-move-resources-form.error-path-not-found', 'Path not found'),
          });
          continue;
        }

        if (!targetFolderPathInRepo) {
          failures.push({
            status: 'failed',
            title: `${isFolder ? 'Folder' : 'Dashboard'}: ${displayName}`,
            errorMessage: t(
              'browse-dashboards.bulk-move-resources-form.error-target-folder-path-missing',
              'Target folder path is missing'
            ),
          });
          continue;
        }

        const newPath = getResourceTargetPath(currentPath, targetFolderPathInRepo);
        const fileBody = await createFileBody(isFolder, displayName, currentPath);

        // Build move parameters
        const moveParams: CreateRepositoryFilesWithPathApiArg = {
          name: repository.name,
          path: newPath, // NEW target path
          ref: workflow === 'write' ? undefined : data.ref,
          message: data.comment || `Move resource ${displayName}`,
          originalPath: currentPath, // CURRENT path (source)
          body: fileBody, // File content
        };

        // Call endpoint to move resource
        const response = await moveFile(moveParams).unwrap();
        successes.push({ index: i, item: moveParams, data: response });
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
        repoUrl: successes[0].data.urls?.newPullRequestURL,
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
            <Trans i18nKey="browse-dashboards.bulk-move-resources-form.move-warning">
              This will move selected folders and their descendants. In total, this will affect:
            </Trans>
            <DescendantCount selectedItems={{ ...selectedItems, panel: {}, $all: false }} />
          </Box>

          {hasSubmitted ? (
            <BulkActionPostSubmitStep
              action="move"
              progress={progress}
              successState={successState}
              failureResults={failureResults}
              handleSuccess={handleSuccess}
              setFailureResults={setFailureResults}
            />
          ) : (
            <>
              {/* Target folder selection */}
              <Field noMargin label={t('browse-dashboards.bulk-move-resources-form.target-folder', 'Target Folder')}>
                <FolderPicker value={targetFolderUID} onChange={setTargetFolderUID} />
              </Field>
              <ResourceEditFormSharedFields
                resourceType="folder"
                isNew={false}
                workflow={workflow}
                workflowOptions={workflowOptions}
                repository={repository}
                hidePath
              />

              <Stack gap={2}>
                <Button type="submit" disabled={moveRequest.isLoading || !!failureResults}>
                  {moveRequest.isLoading
                    ? t('browse-dashboards.bulk-move-resources-form.button-moving', 'Moving...')
                    : t('browse-dashboards.bulk-move-resources-form.button-move', 'Move')}
                </Button>
                <Button variant="secondary" fill="outline" onClick={onDismiss} disabled={moveRequest.isLoading}>
                  <Trans i18nKey="browse-dashboards.bulk-move-resources-form.button-cancel">Cancel</Trans>
                </Button>
              </Stack>
            </>
          )}
        </Stack>
      </form>
    </FormProvider>
  );
}

export function BulkMoveProvisionedResource({ folderUid, selectedItems, onDismiss }: BulkActionProvisionResourceProps) {
  const { repository, folder } = useGetResourceRepositoryView({ folderName: folderUid });

  const workflowOptions = getWorkflowOptions(repository);
  const folderPath = folder?.metadata?.annotations?.[AnnoKeySourcePath] || '';
  const timestamp = generateTimestamp();

  const initialValues = {
    comment: '',
    ref: `bulk-move/${timestamp}`,
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
