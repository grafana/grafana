import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { t, Trans } from '@grafana/i18n';
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

import { DescendantCount } from './DescendantCount';
import { bulkMoveResources, notifyBulkMoveResult } from './utils';

interface FormProps extends BulkMoveProvisionResourceProps {
  initialValues: BaseProvisionedFormData;
  repository: RepositoryView;
  workflowOptions: Array<{ label: string; value: string }>;
  isGitHub: boolean;
}

interface BulkMoveProvisionResourceProps {
  folderUid?: string;
  selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>;
  onClose: () => void;
}

export function FormContent({
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

  const [targetFolderUID, setTargetFolderUID] = useState<string>(folderUid || '');
  const { data: targetFolder } = useGetFolderQuery({ name: targetFolderUID! }, { skip: !targetFolderUID });
  const navigate = useNavigate();

  const methods = useForm<BaseProvisionedFormData>({ defaultValues: initialValues });
  const { handleSubmit, watch } = methods;
  const [workflow] = watch(['workflow']);

  const onFolderChange = (folderUid?: string) => {
    setTargetFolderUID(folderUid || '');
  };

  const handleSubmitForm = async (formData: BaseProvisionedFormData) => {
    if (!targetFolder || !repository) {
      return;
    }

    setIsLoading(true);

    const folderAnnotations = targetFolder?.metadata.annotations || {};

    const results = await bulkMoveResources({
      selectedItems,
      targetFolderPath: folderAnnotations[AnnoKeySourcePath],
      repository,
      mutations: { createFile, deleteFile },
      options: { ...formData },
    });

    notifyBulkMoveResult('move', results, () => onClose());

    if (results.successful.length > 0 && results.failed.length === 0) {
      navigate('/dashboards');
    }

    setIsLoading(false);
  };

  const canSubmit = targetFolderUID && !isLoading;

  return (
    <Drawer onClose={onClose} title={t('browse-dashboards.bulk-move-resources-form.title', 'Bulk Move Resources')}>
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(handleSubmitForm)}>
          <Stack direction="column" gap={2}>
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
              <Button variant="primary" type="submit" disabled={!canSubmit}>
                {isLoading
                  ? t('browse-dashboards.bulk-move-resources-form.moving', 'Moving...')
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
    title: '', // its ok to be empty, we don't use it
    comment: '',
    ref: `bulk-move/${timestamp}`,
    workflow: getDefaultWorkflow(repository),
    path: `${path}/`,
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
