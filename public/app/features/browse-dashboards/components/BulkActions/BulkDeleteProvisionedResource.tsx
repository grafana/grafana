import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import { Alert, Box, Button, Stack } from '@grafana/ui';
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
import { buildResourceBranchRedirectUrl } from 'app/features/dashboard-scene/settings/utils';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { WorkflowOption } from 'app/features/provisioning/types';
import { useSelector } from 'app/types/store';

import { useChildrenByParentUIDState, rootItemsSelector } from '../../state/hooks';
import { findItem } from '../../state/utils';
import { DashboardTreeSelection } from '../../types';
import { DescendantCount } from '../BrowseActions/DescendantCount';
import { collectSelectedItems, fetchProvisionedDashboardPath } from '../utils';

import { BulkActionFailureBanner, MoveResultFailed } from './BulkActionFailureBanner';
import { BulkActionProgress, ProgressState } from './BulkActionProgress';

interface BulkDeleteFormData {
  comment: string;
  ref: string;
  workflow?: WorkflowOption;
}

interface FormProps extends BulkDeleteProvisionResourceProps {
  initialValues: BulkDeleteFormData;
  repository: RepositoryView;
  workflowOptions: Array<{ label: string; value: string }>;
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

type MoveResultSuccessState = {
  allSuccess: boolean;
  repoUrl?: string;
};

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
  const methods = useForm<BulkDeleteFormData>({ defaultValues: initialValues });
  const childrenByParentUID = useChildrenByParentUIDState();
  const rootItems = useSelector(rootItemsSelector);
  const { handleSubmit, watch } = methods;
  const workflow = watch('workflow');
  const navigate = useNavigate();

  const getResourcePath = async (uid: string, isFolder: boolean): Promise<string | undefined> => {
    const item = findItem(rootItems?.items || [], childrenByParentUID, uid);
    if (!item) {
      return undefined;
    }
    return isFolder ? `${folderPath}/${item.title}/` : fetchProvisionedDashboardPath(uid);
  };

  const handleSuccess = () => {
    if (workflow === 'branch') {
      onDismiss?.();
      if (successState.repoUrl) {
        const url = buildResourceBranchRedirectUrl({
          paramName: 'repo_url',
          paramValue: successState.repoUrl,
          repoType: repository.type,
        });

        navigate(url);
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
    setHasSubmitted(true);

    const targets = collectSelectedItems(selectedItems, childrenByParentUID, rootItems?.items || []);

    if (targets.length > 0) {
      setProgress({
        current: 0,
        total: targets.length,
        item: targets[0].displayName || 'Unknown',
      });
    }

    const successes: BulkSuccessResponse = [];
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

  const getPostSubmitContent = () => {
    if (progress) {
      return <BulkActionProgress progress={progress} />;
    }

    if (successState.allSuccess) {
      return (
        <>
          <Alert severity="success" title={t('browse-dashboards.bulk-delete-resources-form.progress-title', 'Success')}>
            <Trans i18nKey="browse-dashboards.bulk-delete-resources-form.success-message">
              All resources have been deleted successfully.
            </Trans>
          </Alert>
          <Stack gap={2}>
            <Button onClick={() => handleSuccess()}>
              <Trans i18nKey="browse-dashboards.bulk-delete-resources-form.button-done">Done</Trans>
            </Button>
          </Stack>
        </>
      );
    } else if (failureResults) {
      return <BulkActionFailureBanner result={failureResults} onDismiss={() => setFailureResults(undefined)} />;
    }

    return null;
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
            getPostSubmitContent()
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
}: BulkDeleteProvisionResourceProps) {
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
