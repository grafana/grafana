import { skipToken } from '@reduxjs/toolkit/query';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { FolderPicker, getAppEvents } from '@grafana/runtime';
import { Box, Button, Field, Stack } from '@grafana/ui';
import { useGetFolderQuery } from 'app/api/clients/folder/v1beta1';
import { RepositoryView, Job } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import { DescendantCount } from 'app/features/browse-dashboards/components/BrowseActions/DescendantCount';
import { collectSelectedItems } from 'app/features/browse-dashboards/components/utils';
import { JobStatus } from 'app/features/provisioning/Job/JobStatus';
import { getDefaultWorkflow, getWorkflowOptions } from 'app/features/provisioning/components/defaults';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';

import { useSelectionRepoValidation } from '../../hooks/useSelectionRepoValidation';
import { RepoInvalidStateBanner } from '../shared/RepoInvalidStateBanner';
import { ResourceEditFormSharedFields } from '../shared/ResourceEditFormSharedFields';
import { generateTimestamp } from '../utils/timestamp';

import { MoveJobSpec, useBulkActionJob } from './useBulkActionJob';
import { BulkActionFormData, BulkActionProvisionResourceProps, getTargetFolderPathInRepo } from './utils';

interface FormProps extends BulkActionProvisionResourceProps {
  initialValues: BulkActionFormData;
  repository: RepositoryView;
  workflowOptions: Array<{ label: string; value: string }>;
  folderPath?: string;
}

function FormContent({ initialValues, selectedItems, repository, workflowOptions, onDismiss }: FormProps) {
  // States
  const [job, setJob] = useState<Job>();
  const [targetFolderUID, setTargetFolderUID] = useState<string | undefined>(undefined);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Hooks
  const { createBulkJob, isLoading: isCreatingJob } = useBulkActionJob();
  const methods = useForm<BulkActionFormData>({ defaultValues: initialValues });
  const {
    handleSubmit,
    watch,
    setError,
    clearErrors,
    formState: { errors },
  } = methods;
  const workflow = watch('workflow');

  // Get target folder data
  const { data: targetFolder } = useGetFolderQuery(targetFolderUID ? { name: targetFolderUID } : skipToken);

  const setupMoveOperation = () => {
    const targetFolderPathInRepo = getTargetFolderPathInRepo({
      targetFolderUID,
      targetFolder,
      repoName: repository.name,
    });
    const resources = collectSelectedItems(selectedItems);

    return { targetFolderPathInRepo, resources };
  };

  const handleSubmitForm = async (data: BulkActionFormData) => {
    setHasSubmitted(true);

    // 1. Setup
    const { targetFolderPathInRepo, resources } = setupMoveOperation();

    if (!targetFolderPathInRepo) {
      setError('targetFolderUID', {
        type: 'manual',
        message: t(
          'browse-dashboards.bulk-move-resources-form.error-no-target-folder-path',
          'Target folder path is invalid or empty, please select again.'
        ),
      });
      setHasSubmitted(false);
      return;
    }

    // Create the move job spec
    const jobSpec: MoveJobSpec = {
      action: 'move',
      move: {
        ref: data.workflow === 'write' ? undefined : data.ref,
        targetPath: targetFolderPathInRepo,
        resources,
      },
    };

    const result = await createBulkJob(repository, jobSpec);

    if (result.success && result.job) {
      setJob(result.job); // Store the job for tracking
    } else if (!result.success && result.error) {
      getAppEvents().publish({
        type: AppEvents.alertError.name,
        payload: [
          t('browse-dashboards.bulk-move-resources-form.error-moving-resources', 'Error moving resources'),
          result.error,
        ],
      });
      setHasSubmitted(false);
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

          {hasSubmitted && job ? (
            <JobStatus watch={job} jobType="move" />
          ) : (
            <>
              {/* Target folder selection */}
              <Field
                noMargin
                label={t('browse-dashboards.bulk-move-resources-form.target-folder', 'Target Folder')}
                error={errors.targetFolderUID?.message}
                invalid={!!errors.targetFolderUID}
              >
                <FolderPicker
                  value={targetFolderUID}
                  onChange={(uid) => {
                    setTargetFolderUID(uid || '');
                    clearErrors('targetFolderUID');
                  }}
                />
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
                <Button
                  type="submit"
                  disabled={!!job || isCreatingJob || hasSubmitted || targetFolderUID === undefined}
                >
                  {isCreatingJob
                    ? t('browse-dashboards.bulk-move-resources-form.button-moving', 'Moving...')
                    : t('browse-dashboards.bulk-move-resources-form.button-move', 'Move')}
                </Button>
                <Button variant="secondary" fill="outline" onClick={onDismiss} disabled={isCreatingJob}>
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
  // Check if we're on the root browser dashboards page
  const isRootPage = !folderUid || folderUid === GENERAL_FOLDER_UID;
  const { selectedItemsRepoUID } = useSelectionRepoValidation(selectedItems);
  const { repository, folder, isReadOnlyRepo } = useGetResourceRepositoryView({
    folderName: isRootPage ? selectedItemsRepoUID : folderUid,
  });

  const workflowOptions = getWorkflowOptions(repository);
  const folderPath = folder?.metadata?.annotations?.[AnnoKeySourcePath] || '';
  const timestamp = generateTimestamp();

  const initialValues = {
    comment: '',
    ref: `bulk-move/${timestamp}`,
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
      folderPath={isRootPage ? '/' : folderPath}
    />
  );
}
