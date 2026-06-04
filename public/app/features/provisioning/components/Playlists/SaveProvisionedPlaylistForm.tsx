import { createElement, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Stack } from '@grafana/ui';
import { type Playlist, playlistAPIv1 } from 'app/api/clients/playlist/v1';
import { type RepositoryView, useReplaceRepositoryFilesWithPathMutation } from 'app/api/clients/provisioning/v0alpha1';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { useDispatch } from 'app/types/store';

import { ProvisioningAlert } from '../../Shared/ProvisioningAlert';
import { PushSuccessMessage } from '../../hooks/PushSuccessMessage';
import { useProvisionedPlaylistData } from '../../hooks/useProvisionedPlaylistData';
import { type ProvisionedOperationInfo, useProvisionedRequestHandler } from '../../hooks/useProvisionedRequestHandler';
import { type BaseProvisionedFormData } from '../../types/form';
import { getSingleResourceCommitMessage } from '../../utils/commitMessage';
import { getCurrentCommitUser } from '../../utils/currentUser';
import { RepoInvalidStateBanner } from '../Shared/RepoInvalidStateBanner';
import { ResourceEditFormSharedFields } from '../Shared/ResourceEditFormSharedFields';
import { getProvisionedRequestError } from '../utils/errors';

interface SaveProvisionedPlaylistFormProps {
  /** The playlist with the edited spec that should be committed to the repository. */
  playlist: Playlist;
  onDismiss?: () => void;
}

interface FormProps extends SaveProvisionedPlaylistFormProps {
  initialValues: BaseProvisionedFormData;
  repository?: RepositoryView;
  canPushToConfiguredBranch: boolean;
}

function FormContent({ playlist, initialValues, repository, canPushToConfiguredBranch, onDismiss }: FormProps) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | undefined>(undefined);
  const [replaceFile, request] = useReplaceRepositoryFilesWithPathMutation();

  const methods = useForm<BaseProvisionedFormData>({
    defaultValues: initialValues,
    mode: 'onBlur',
  });
  const { handleSubmit, watch } = methods;
  const [ref, workflow] = watch(['ref', 'workflow']);

  const showError = (error: unknown) => {
    setError(
      getProvisionedRequestError(
        error,
        'playlist',
        t('playlist-edit.save-provisioned.error-saving', 'Failed to save playlist')
      )
    );
  };

  const goToPlaylists = () => {
    // Managing the playlist list happens elsewhere; invalidate so the change shows up there.
    dispatch(playlistAPIv1.util.invalidateTags(['Playlist']));
    onDismiss?.();
    navigate('/playlists');
  };

  const onWriteSuccess = () => {
    goToPlaylists();
  };

  const onBranchSuccess = (
    { ref: branchRef, urls }: { ref: string; path: string; urls?: Record<string, string> },
    info: ProvisionedOperationInfo
  ) => {
    // No preview page exists for playlists, so surface the branch/PR link as a notification
    // (the request handler suppresses its own notification for the branch workflow).
    const linkUrl = urls?.newPullRequestURL ?? repository?.url;
    dispatch(
      notifyApp(
        createSuccessNotification(
          '',
          '',
          undefined,
          createElement(PushSuccessMessage, { branch: branchRef, url: linkUrl })
        )
      )
    );
    goToPlaylists();
  };

  useProvisionedRequestHandler({
    request,
    workflow,
    resourceType: 'playlist',
    repository,
    selectedBranch: ref,
    handlers: {
      onDismiss,
      onWriteSuccess,
      onBranchSuccess,
      onError: showError,
    },
  });

  const doSave = async ({ ref, workflow, comment, path }: BaseProvisionedFormData) => {
    setError(undefined);
    const repoName = repository?.name;

    if (!repoName || !path) {
      showError(t('playlist-edit.save-provisioned.missing-info', 'Missing required fields for saving'));
      return;
    }

    // For the write workflow we commit to the configured branch; otherwise use the selected branch.
    const branchRef = workflow === 'write' ? undefined : ref;

    reportInteraction('grafana_provisioning_playlist_save_submitted', {
      workflow,
      repositoryName: repoName,
      repositoryType: repository?.type ?? 'unknown',
    });

    // Success/error handling is done by useProvisionedRequestHandler via the `request` object.
    replaceFile({
      name: repoName,
      path,
      ref: branchRef,
      message: getSingleResourceCommitMessage({
        comment,
        repository,
        action: 'update',
        resourceKind: 'playlist',
        resourceID: playlist.metadata?.name ?? '',
        title: playlist.spec?.title ?? '',
        ...getCurrentCommitUser(),
      }),
      body: {
        apiVersion: playlist.apiVersion,
        kind: playlist.kind,
        metadata: { name: playlist.metadata?.name },
        spec: playlist.spec,
      },
    });
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(doSave)}>
        <Stack direction="column" gap={2}>
          <ResourceEditFormSharedFields
            resourceType="playlist"
            isNew={false}
            canPushToConfiguredBranch={canPushToConfiguredBranch}
            repository={repository}
          />

          {error && <ProvisioningAlert error={error} />}

          <Stack gap={2}>
            <Button variant="secondary" fill="outline" onClick={onDismiss}>
              {t('playlist-edit.save-provisioned.button-cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={request.isLoading}>
              {request.isLoading
                ? t('playlist-edit.save-provisioned.button-saving', 'Saving...')
                : t('playlist-edit.save-provisioned.button-save', 'Save')}
            </Button>
          </Stack>
        </Stack>
      </form>
    </FormProvider>
  );
}

export function SaveProvisionedPlaylistForm({ playlist, onDismiss }: SaveProvisionedPlaylistFormProps) {
  const { repository, initialValues, isReadOnlyRepo, canPushToConfiguredBranch } = useProvisionedPlaylistData({
    playlist,
  });

  if (isReadOnlyRepo || !initialValues) {
    return (
      <RepoInvalidStateBanner
        noRepository={!initialValues}
        isReadOnlyRepo={isReadOnlyRepo}
        readOnlyMessage={t(
          'playlist-edit.save-provisioned.read-only-message',
          'To edit this playlist, please update the file in your repository directly.'
        )}
      />
    );
  }

  return (
    <FormContent
      playlist={playlist}
      onDismiss={onDismiss}
      initialValues={initialValues}
      repository={repository}
      canPushToConfiguredBranch={canPushToConfiguredBranch}
    />
  );
}
