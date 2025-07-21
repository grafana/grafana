import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Box, Button, Drawer, Field, Stack } from '@grafana/ui';
import { useGetFolderQuery } from 'app/api/clients/folder/v1beta1';
import {
  RepositoryView,
  useCreateRepositoryFilesWithPathMutation,
  useDeleteRepositoryFilesWithPathMutation,
} from 'app/api/clients/provisioning/v0alpha1';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import { ResourceEditFormSharedFields } from 'app/features/dashboard-scene/components/Provisioned/ResourceEditFormSharedFields';
import { getDefaultWorkflow, getWorkflowOptions } from 'app/features/dashboard-scene/saving/provisioned/defaults';
import { generateTimestamp } from 'app/features/dashboard-scene/saving/provisioned/utils/timestamp';
import { BaseProvisionedFormData } from 'app/features/dashboard-scene/saving/shared';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';

import { DashboardTreeSelection } from '../../types';

import { BulkMoveFailedBanner } from './BulkMoveFailedBanner';
import { BulkMoveProgress, ProgressState } from './BulkMoveProgress';
import { DescendantCount } from './DescendantCount';
import { bulkMoveResources, BulkMoveResult, ProgressCallback } from './utils';

interface FormProps extends BulkMoveProvisionResourceProps {
  initialValues: Omit<BaseProvisionedFormData, 'title'>;
  repository: RepositoryView;
  workflowOptions: Array<{ label: string; value: string }>;
  isGitHub: boolean;
}

interface BulkMoveProvisionResourceProps {
  folderUid?: string;
  selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>;
  onClose: () => void;
}

function FormContent({
  selectedItems,
  initialValues,
  folderUid,
  workflowOptions,
  isGitHub,
  repository,
  onClose,
}: FormProps) {
  const [createFile] = useCreateRepositoryFilesWithPathMutation();
  const [deleteFile] = useDeleteRepositoryFilesWithPathMutation();
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<BulkMoveResult | undefined>();
  const [progress, setProgress] = useState<ProgressState | null>(null);

  const [targetFolderUID, setTargetFolderUID] = useState<string | undefined>(undefined);
  const { data: targetFolder } = useGetFolderQuery({ name: targetFolderUID! }, { skip: !targetFolderUID });
  const navigate = useNavigate();
  const appEvents = getAppEvents();

  const methods = useForm<BaseProvisionedFormData>({ defaultValues: initialValues });
  const { handleSubmit, watch } = methods;
  const [workflow] = watch(['workflow']);

  const onFolderChange = (folderUid?: string) => {
    setTargetFolderUID(folderUid || '');
  };

  const onProgressUpdate: ProgressCallback = (current, total, item) => {
    setProgress({ current, total, item });
  };

  const handleSubmitForm = async (formData: BaseProvisionedFormData) => {
    if (targetFolderUID == null || !repository) {
      return;
    }

    setIsLoading(true);
    setResults(undefined);
    setProgress(null);

    try {
      const folderAnnotations = targetFolder?.metadata.annotations || {};
      const targetPath = folderAnnotations[AnnoKeySourcePath] || ''; // Handle root folder

      const results = await bulkMoveResources({
        selectedItems,
        targetFolderPath: targetPath,
        repository,
        mutations: { createFile, deleteFile },
        options: { ...formData },
        onProgress: onProgressUpdate,
      });

      if (results.successful.length > 0 && results.failed.length === 0) {
        // All resources moved successfully
        appEvents.publish({
          type: AppEvents.alertSuccess.name,
          payload: [
            t('browse-dashboards.bulk-move-resources-form.success', 'Successfully moved {{count}} dashboard(s)', {
              count: results.successful.length,
            }),
          ],
        });
        onClose();

        // Navigate to target folder
        if (targetFolderUID && targetFolderUID !== 'general') {
          navigate(`/dashboards/f/${targetFolderUID}/`);
        } else {
          navigate('/dashboards');
        }
      } else {
        // Some failures occurred
        setResults(results);

        if (results.successful.length > 0) {
          appEvents.publish({
            type: AppEvents.alertWarning.name,
            payload: [
              t(
                'browse-dashboards.bulk-move-resources-form.partial-success',
                'Moved {{successCount}} dashboard(s), {{failedCount}} failed',
                {
                  successCount: results.successful.length,
                  failedCount: results.failed.length,
                }
              ),
            ],
          });
        }
      }
    } catch (error) {
      console.error('Bulk move operation failed:', error);
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: [
          t('browse-dashboards.bulk-move-resources-form.error', 'Bulk move operation failed'),
          error instanceof Error ? error.message : 'Unknown error',
        ],
      });
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  };

  const canSubmit = targetFolderUID != null && !isLoading;

  return (
    <Drawer onClose={onClose} title={t('browse-dashboards.bulk-move-resources-form.title', 'Bulk Move Resources')}>
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(handleSubmitForm)}>
          <Stack direction="column" gap={2}>
            {/* Bulk move failed banner */}
            {results && <BulkMoveFailedBanner result={results} onDismiss={() => setResults(undefined)} />}

            {/* Progress indicator */}
            {progress && <BulkMoveProgress progress={progress} />}

            <Box paddingBottom={2}>
              <Trans i18nKey="browse-dashboards.bulk-move-resources-form.move-warning">
                This will move selected resources and their descendants. In total, this will affect:
              </Trans>
              <DescendantCount selectedItems={{ ...selectedItems, panel: {}, $all: false }} />
            </Box>

            {/* Target folder selection */}
            <Field noMargin label={t('browse-dashboards.bulk-move-resources-form.target-folder', 'Target Folder')}>
              <FolderPicker value={targetFolderUID} onChange={onFolderChange} />
            </Field>

            <ResourceEditFormSharedFields
              resourceType="folder"
              readOnly={isLoading}
              workflow={workflow}
              workflowOptions={workflowOptions}
              isGitHub={isGitHub}
            />

            <Stack gap={2}>
              <Button variant="primary" type="submit" disabled={!canSubmit || !!results}>
                {isLoading
                  ? progress
                    ? t('browse-dashboards.bulk-move-resources-form.moving', 'Moving... ({{current}}/{{total}})', {
                        current: progress.current,
                        total: progress.total,
                      })
                    : t('browse-dashboards.bulk-move-resources-form.preparing', 'Preparing...')
                  : t('browse-dashboards.bulk-move-resources-form.move-action', 'Move Resources')}
              </Button>
              <Button variant="secondary" onClick={onClose} fill="outline" disabled={isLoading}>
                <Trans i18nKey="browse-dashboards.bulk-move-resources-form.cancel-action">Cancel</Trans>
              </Button>
            </Stack>
          </Stack>
        </form>
      </FormProvider>
    </Drawer>
  );
}

export function BulkMoveProvisionedResourceDrawer({
  folderUid,
  selectedItems,
  onClose,
}: BulkMoveProvisionResourceProps) {
  const { repository, folder } = useGetResourceRepositoryView({ folderName: folderUid });

  const workflowOptions = getWorkflowOptions(repository);
  const isGitHub = repository?.type === 'github';
  const timestamp = generateTimestamp();
  const path = folder?.metadata.annotations?.[AnnoKeySourcePath] || '';

  const initialValues = {
    repo: repository?.name || '',
    comment: '',
    ref: `bulk-move/${timestamp}`,
    workflow: getDefaultWorkflow(repository),
    path: path ? `${path}/` : '', // Handle root folder
  };

  if (!repository) {
    return null;
  }

  return (
    <FormContent
      repository={repository}
      selectedItems={selectedItems}
      initialValues={initialValues}
      folderUid={folderUid}
      workflowOptions={workflowOptions}
      isGitHub={isGitHub}
      onClose={onClose}
    />
  );
}
