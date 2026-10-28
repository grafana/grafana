import { skipToken } from '@reduxjs/toolkit/query';
import { useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents, reportInteraction } from '@grafana/runtime';
import { Button, Field, Stack } from '@grafana/ui';
import { useGetFolderQuery } from 'app/api/clients/folder/v1beta1';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { extractErrorMessage } from 'app/api/utils';
import { AffectedFolderContents } from 'app/features/browse-dashboards/components/BrowseActions/AffectedFolderContents';
import { collectSelectedItems, getSelectedUIDs } from 'app/features/browse-dashboards/utils/dashboards';
import { getCanPushToConfiguredBranch } from 'app/features/provisioning/components/defaults';
import {
  RepoViewStatus,
  useGetResourceRepositoryView,
} from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { isRootFolderUID } from 'app/features/search/constants';

import { useCommitMessageTemplate } from '../../hooks/useCommitMessageTemplate';
import { getJobRef, useResourceJob } from '../../hooks/useResourceJob';
import { useSelectedItemParentUIDs } from '../../hooks/useSelectedItemParentUIDs';
import { useSelectionRepoValidation } from '../../hooks/useSelectionRepoValidation';
import { type MoveJobSpec } from '../../types/job';
import { type CommitTemplateVars } from '../../utils/commitMessage';
import { getCurrentCommitUser } from '../../utils/currentUser';
import { getRequestRef, getWorkflowForRef } from '../../utils/workflow';
import { ProvisionedFormGate } from '../ProvisionedFormGate';
import { MoveActionAvailableTargetWarning } from '../Shared/MoveActionAvailableTargetWarning';
import { ProvisioningAwareFolderPicker } from '../Shared/ProvisioningAwareFolderPicker';
import { ResourceEditFormSharedFields } from '../Shared/ResourceEditFormSharedFields';
import { ResourceJobStatus } from '../Shared/ResourceJobStatus';

import {
  type BulkActionFormData,
  type BulkActionProvisionResourceProps,
  getBulkActionInitialValues,
  getSelectedResourceCountSummary,
  getTargetFolderPathInRepo,
  isSelectionAlreadyInFolder,
} from './utils';

interface FormProps extends BulkActionProvisionResourceProps {
  initialValues: BulkActionFormData;
  repository: RepositoryView;
  canPushToConfiguredBranch: boolean;
}

function FormContent({
  initialValues,
  selectedItems,
  repository,
  canPushToConfiguredBranch,
  onDismiss,
  onJobCreated,
}: FormProps) {
  const [targetFolderUID, setTargetFolderUID] = useState<string | undefined>(undefined);

  const { submitted, submit, isCreating } = useResourceJob({ repository });
  const selectedItemParentUIDs = useSelectedItemParentUIDs(selectedItems);
  const methods = useForm<BulkActionFormData>({ defaultValues: initialValues });
  const {
    handleSubmit,
    setError,
    clearErrors,
    watch,
    setValue,
    formState: { errors, dirtyFields },
  } = methods;

  const fallbackMessage = t('browse-dashboards.bulk-move-resources-form.default-commit-message', 'Move resources');
  // Bulk operations span multiple resources, so `resourceKind` is omitted and `title` is a count
  // summary rather than a single resource name.
  const templateVars: CommitTemplateVars = {
    action: 'move',
    resourceID: '',
    title: getSelectedResourceCountSummary(selectedItems),
    ...getCurrentCommitUser(),
  };
  const { locked, message } = useCommitMessageTemplate({
    repository,
    vars: templateVars,
    comment: watch('comment') ?? '',
    isCommentDirty: Boolean(dirtyFields.comment),
    setComment: (value) => setValue('comment', value, { shouldDirty: false }),
    fallbackMessage,
  });

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
    // 1. Setup
    const { targetFolderPathInRepo, resources } = setupMoveOperation();

    if (targetFolderUID === undefined || !targetFolderPathInRepo) {
      setError('targetFolderUID', {
        type: 'manual',
        message: t(
          'browse-dashboards.bulk-move-resources-form.error-no-target-folder-path',
          'Target folder path is invalid or empty, please select again.'
        ),
      });
      return;
    }

    if (isSelectionAlreadyInFolder(selectedItemParentUIDs, targetFolderUID)) {
      setError('targetFolderUID', {
        type: 'manual',
        message: t(
          'browse-dashboards.bulk-move-resources-form.error-already-in-target-folder',
          'Selected resources are already in the target folder.'
        ),
      });
      return;
    }

    const workflow = getWorkflowForRef(repository, data.ref);
    reportInteraction('grafana_provisioning_bulk_move_submitted', {
      workflow,
      repositoryName: repository.name ?? 'unknown',
      repositoryType: repository.type ?? 'unknown',
      resourceCount: resources.length,
    });

    const jobSpec: MoveJobSpec = {
      action: 'move',
      message,
      move: {
        ref: getRequestRef(repository, data.ref),
        targetPath: targetFolderPathInRepo,
        resources,
      },
    };

    try {
      await submit(jobSpec);
      onJobCreated?.();
    } catch (error) {
      getAppEvents().publish({
        type: AppEvents.alertError.name,
        payload: [
          t('browse-dashboards.bulk-move-resources-form.error-moving-resources', 'Error moving resources'),
          extractErrorMessage(
            error,
            t('browse-dashboards.bulk-actions.error-generic', 'Unexpected error happened when creating job')
          ),
        ],
      });
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(handleSubmitForm)}>
        <Stack direction="column" gap={2}>
          {submitted ? (
            <ResourceJobStatus
              job={submitted.job}
              jobType="move"
              successTitle={
                getJobRef(submitted.jobSpec)
                  ? t('provisioning.bulk-action.success-title-branch', 'Requested changes were pushed to a branch')
                  : t('browse-dashboards.bulk-move-resources-form.success-title', 'Resources moved successfully')
              }
            />
          ) : (
            <>
              <MoveActionAvailableTargetWarning />
              <AffectedFolderContents
                selectedItems={selectedItems}
                nonEmptyMessage={t('browse-dashboards.bulk-move-resources-form.folder-not-empty', '', {
                  count: getSelectedUIDs(selectedItems, 'folder').length,
                  defaultValue_one: 'Selected folder contains resources that will be moved with it',
                  defaultValue_other: 'Selected folders contain resources that will be moved with them',
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
                  excludeUIDs={getSelectedUIDs(selectedItems, 'folder')}
                />
              </Field>
              <ResourceEditFormSharedFields
                resourceType="folder"
                isNew={false}
                canPushToConfiguredBranch={canPushToConfiguredBranch}
                repository={repository}
                hiddenFields={['path']}
                lockComment={locked}
                commitMessage={message}
              />

              <Stack gap={2}>
                <Button variant="secondary" fill="outline" onClick={onDismiss} disabled={isCreating}>
                  <Trans i18nKey="browse-dashboards.bulk-move-resources-form.button-cancel">Cancel</Trans>
                </Button>
                <Button type="submit" disabled={isCreating || targetFolderUID === undefined}>
                  {isCreating
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

export function BulkMoveProvisionedResource({
  folderUid,
  selectedItems,
  onDismiss,
  onJobCreated,
}: BulkActionProvisionResourceProps) {
  // Check if we're on the root browser dashboards page
  const isRootPage = isRootFolderUID(folderUid);
  const { selectedItemsRepoUID } = useSelectionRepoValidation(selectedItems);

  // Capture the repo UID so it survives selection state changes during/after job execution
  const resolvedRepoUID = useRef(selectedItemsRepoUID);
  if (selectedItemsRepoUID) {
    resolvedRepoUID.current = selectedItemsRepoUID;
  }

  const { repository, isReadOnlyRepo, isMissingRepo, isLoading, status } = useGetResourceRepositoryView({
    folderName: isRootPage ? resolvedRepoUID.current : folderUid,
  });

  const canPushToConfiguredBranch = getCanPushToConfiguredBranch(repository);

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
          onJobCreated={onJobCreated}
          initialValues={initialValues}
          repository={repository}
          canPushToConfiguredBranch={canPushToConfiguredBranch}
        />
      )}
    </ProvisionedFormGate>
  );
}
