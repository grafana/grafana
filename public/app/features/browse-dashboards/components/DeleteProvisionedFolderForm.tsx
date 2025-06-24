import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Box, Button, Stack } from '@grafana/ui';
import { useDeleteRepositoryFilesWithPathMutation } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import { DashboardEditFormSharedFields } from 'app/features/dashboard-scene/components/Provisioned/DashboardEditFormSharedFields';
import { BaseProvisionedFormData } from 'app/features/dashboard-scene/saving/shared';
import { FolderDTO } from 'app/types';

import { useProvisionedFolderFormData } from '../hooks/useProvisionedFolderFormData';

import { DescendantCount } from './BrowseActions/DescendantCount';
import { getFolderURL } from './utils';

interface DeleteProvisionedFolderFormProps {
  parentFolder?: FolderDTO;
}

export function DeleteProvisionedFolderForm({ parentFolder }: DeleteProvisionedFolderFormProps) {
  const resourceId = parentFolder?.uid || '';

  // form related
  const methods = useForm<BaseProvisionedFormData>(); // form initial value will be set by useProvisionedFolderFormData
  const { reset, handleSubmit, watch } = methods;
  const [ref, workflow] = watch(['ref', 'workflow']);

  const [deleteRepoFile, request] = useDeleteRepositoryFilesWithPathMutation();
  const { workflowOptions, isGitHub, repository, folder } = useProvisionedFolderFormData({
    folderUid: parentFolder?.uid,
    action: 'delete',
    reset,
    title: parentFolder?.title,
  });

  const handleSubmitForm = async ({ repo, path, comment }: BaseProvisionedFormData) => {
    if (!repository?.name) {
      return;
    }

    const commitMessage = comment || `Delete folder: ${folder?.metadata?.annotations?.[AnnoKeySourcePath]}`;
    const targetRef = workflow === 'write' ? undefined : ref;
    deleteRepoFile({
      name: repo,
      path: `${path}/`,
      ref: targetRef,
      message: commitMessage,
    });
  };

  // TODO: move to a hook if this useEffect shared mostly the same logic as in NewProvisionedFolderForm
  useEffect(() => {
    if (request.isSuccess && repository) {
      if (workflow === 'branch') {
        // TODO: handle display banner https://github.com/grafana/git-ui-sync-project/issues/300
        // TODO: implement when BE is ready
        return;
      }

      if (workflow === 'write') {
        getAppEvents().publish({
          type: AppEvents.alertSuccess.name,
          payload: [
            t(
              'browse-dashboards.delete-provisioned-folder-form.alert-folder-deleted-successfully',
              'Folder deleted successfully'
            ),
          ],
        });
        // Navigate back to parent folder if it exists, otherwise go to dashboards root
        if (parentFolder?.parentUid) {
          window.location.href = getFolderURL(parentFolder.parentUid);
        } else {
          window.location.href = '/dashboards';
        }
      }
    }

    if (request.isError) {
      console.error('Error deleting folder:', request.error);
      getAppEvents().publish({
        type: AppEvents.alertError.name,
        payload: [
          t('browse-dashboards.delete-provisioned-folder-form.api-error', 'Failed to delete folder'),
          request.error,
        ],
      });
      return;
    }
  }, [request, repository, workflow, parentFolder]);

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(handleSubmitForm)}>
        <Stack direction="column" gap={2}>
          <Box paddingBottom={2}>
            <Trans i18nKey="browse-dashboards.delete-provisioned-folder-form.delete-warning">
              This will delete this folder and all its descendants. In total, this will affect:
            </Trans>
            <DescendantCount
              selectedItems={{
                folder: { [resourceId]: true },
                dashboard: {},
                panel: {},
                $all: false,
              }}
            />
          </Box>

          <DashboardEditFormSharedFields
            isNew={false}
            workflow={workflow}
            workflowOptions={workflowOptions}
            isGitHub={isGitHub}
          />

          {/* Delete / Cancel button */}
          <Stack gap={2}>
            <Button type="submit" disabled={request.isLoading}>
              {request.isLoading
                ? t('browse-dashboards.delete-provisioned-folder-form.button-deleting', 'Deleting...')
                : t('browse-dashboards.delete-provisioned-folder-form.button-delete', 'Delete')}
            </Button>
            <Button variant="secondary" fill="outline">
              <Trans i18nKey="browse-dashboards.delete-provisioned-folder-form.button-cancel">Cancel</Trans>
            </Button>
          </Stack>
        </Stack>
      </form>
    </FormProvider>
  );
}
