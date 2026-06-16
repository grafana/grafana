import { skipToken } from '@reduxjs/toolkit/query';
import { useState, useCallback, useRef } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents, reportInteraction } from '@grafana/runtime';
import { Button, Field, Stack } from '@grafana/ui';
import { useGetFolderQuery } from 'app/api/clients/folder/v1beta1';
import { type RepositoryView, type Job } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import { AffectedFolderContents } from 'app/features/browse-dashboards/components/BrowseActions/AffectedFolderContents';
import { getSelectedFolderUIDs } from 'app/features/browse-dashboards/components/BrowseActions/utils';
import { collectSelectedItems } from 'app/features/browse-dashboards/utils/dashboards';
import { JobStatus } from 'app/features/provisioning/Job/JobStatus';
import { getCanPushToConfiguredBranch } from 'app/features/provisioning/components/defaults';
import {
  RepoViewStatus,
  useGetResourceRepositoryView,
} from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { isRootFolderUID } from 'app/features/search/constants';

import { ProvisioningAlert } from '../../Shared/ProvisioningAlert';
import { type StepStatusInfo } from '../../Wizard/types';
import { useSelectionRepoValidation } from '../../hooks/useSelectionRepoValidation';
import { type StatusInfo } from '../../types';
import { withSavedByTrailer } from '../../utils/currentUser';
import { ProvisionedFormGate } from '../ProvisionedFormGate';
import { MoveActionAvailableTargetWarning } from '../Shared/MoveActionAvailableTargetWarning';
import { ProvisioningAwareFolderPicker } from '../Shared/ProvisioningAwareFolderPicker';
import { ResourceEditFormSharedFields } from '../Shared/ResourceEditFormSharedFields';

import { type MoveJobSpec, useBulkActionJob } from './useBulkActionJob';
import {
  type BulkActionFormData,
  type BulkActionProvisionResourceProps,
  getBulkActionInitialValues,
  getTargetFolderPathInRepo,
  isSameFolderPath,
} from './utils';

interface FormProps extends BulkActionProvisionResourceProps {
  initialValues: BulkActionFormData;
  repository: RepositoryView;
  canPushToConfiguredBranch: boolean;
  folderPath?: string;
}

function FormContent({
  initialValues,
  selectedItems,
  repository,
  canPushToConfiguredBranch,
  folderPath,
  onDismiss,
}: FormProps) {
  // States
  const [job, setJob] = useState<Job>();
  const [jobError, setJobError] = useState<string | StatusInfo>();
  const [targetFolderUID, setTargetFolderUID] = useState<string | undefined>(undefined);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Hooks
  const { createBulkJob, isLoading: isCreatingJob } = useBulkActionJob();
  const methods = useForm<BulkActionFormData>({ defaultValues: initialValues });
  const {
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = methods;

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

    if (isSameFolderPath(folderPath, targetFolderPathInRepo)) {
      setError('targetFolderUID', {
        type: 'manual',
        message: t(
          'browse-dashboards.bulk-move-resources-form.error-already-in-target-folder',
          'Selected resources are already in the target folder.'
        ),
      });
      setHasSubmitted(false);
      return;
    }

    reportInteraction('grafana_provisioning_bulk_move_submitted', {
      workflow: data.workflow,
      repositoryName: repository.name ?? 'unknown',
      repositoryType: repository.type ?? 'unknown',
      resourceCount: resources.length,
    });

    // Create the move job spec. The Grafana-saved-by trailer rides through
    // JobSpec.Message to the resulting git commit.
    const jobSpec: MoveJobSpec = {
      action: 'move',
      message: withSavedByTrailer(
        data.comment?.trim() || t('browse-dashboards.bulk-move-resources-form.default-commit-message', 'Move resources')
      ),
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

  const onStatusChange = useCallback((statusInfo: StepStatusInfo) => {
    if (statusInfo.status === 'error' && statusInfo.error) {
      setJobError(statusInfo.error);
    }
  }, []);

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(handleSubmitForm)}>
        <Stack direction="column" gap={2}>
          {hasSubmitted && job ? (
            <>
              <ProvisioningAlert error={jobError} />
              <JobStatus watch={job} jobType="move" onStatusChange={onStatusChange} />
            </>
          ) : (
            <>
              <MoveActionAvailableTargetWarning />
              <AffectedFolderContents
                selectedItems={selectedItems}
                nonEmptyMessage={t('browse-dashboards.bulk-move-resources-form.folder-not-empty', '', {
                  count: getSelectedFolderUIDs(selectedItems).length,
                  defaultValue_one: 'Selected folder contains other resources that will be moved with it',
                  defaultValue_other: 'Selected folders contain other resources that will be moved with them',
                })}
              />
              {/* Target folder selection */}
              <Field
                noMargin
                label={t('browse-dashboards.bulk-move-resources-form.target-folder', 'Target Folder')}
                error={errors.targetFolderUID?.message}
                invalid={!!errors.targetFolderUID}
              >
                <ProvisioningAwareFolderPicker
                  value={targetFolderUID}
                  onChange={(uid) => {
                    setTargetFolderUID(uid || '');
                    clearErrors('targetFolderUID');
                  }}
                  repositoryName={repository.name}
                  // selectedItems.folder contains false entries from deselect ancestor propagation
                  // in setItemSelectionState reducer - filter to only truly-selected UIDs
                  excludeUIDs={getSelectedFolderUIDs(selectedItems)}
                />
              </Field>
              <ResourceEditFormSharedFields
                resourceType="folder"
                isNew={false}
                canPushToConfiguredBranch={canPushToConfiguredBranch}
                repository={repository}
                hiddenFields={['path']}
              />

              <Stack gap={2}>
                <Button variant="secondary" fill="outline" onClick={onDismiss} disabled={isCreatingJob}>
                  <Trans i18nKey="browse-dashboards.bulk-move-resources-form.button-cancel">Cancel</Trans>
                </Button>
                <Button
                  type="submit"
                  disabled={!!job || isCreatingJob || hasSubmitted || targetFolderUID === undefined}
                >
                  {isCreatingJob
                    ? t('browse-dashboards.bulk-move-resources-form.button-moving', 'Moving...')
                    : t('browse-dashboards.bulk-move-resources-form.button-move', 'Move')}
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
  const isRootPage = isRootFolderUID(folderUid);
  const { selectedItemsRepoUID } = useSelectionRepoValidation(selectedItems);

  // Capture the repo UID so it survives selection state changes during/after job execution
  const resolvedRepoUID = useRef(selectedItemsRepoUID);
  if (selectedItemsRepoUID) {
    resolvedRepoUID.current = selectedItemsRepoUID;
  }

  const { repository, folder, isReadOnlyRepo, isMissingRepo, isLoading, status } = useGetResourceRepositoryView({
    folderName: isRootPage ? resolvedRepoUID.current : folderUid,
  });

  const canPushToConfiguredBranch = getCanPushToConfiguredBranch(repository);
  const folderPath = folder?.metadata?.annotations?.[AnnoKeySourcePath] || '';

  const initialValues = getBulkActionInitialValues(repository, 'bulk-move');

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
          folderPath={isRootPage ? '/' : folderPath}
        />
      )}
    </ProvisionedFormGate>
  );
}
