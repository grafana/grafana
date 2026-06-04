import { useNavigate } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
import { type Playlist, playlistAPIv1 } from 'app/api/clients/playlist/v1';
import { useDispatch } from 'app/types/store';

import { SaveProvisionedResourceForm } from '../Shared/SaveProvisionedResourceForm';

interface SaveProvisionedPlaylistFormProps {
  /** The playlist with the edited spec that should be committed to the repository. */
  playlist: Playlist;
  onDismiss?: () => void;
}

export function SaveProvisionedPlaylistForm({ playlist, onDismiss }: SaveProvisionedPlaylistFormProps) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const goToPlaylists = () => {
    // The playlist list is managed elsewhere; invalidate so the change shows up there.
    dispatch(playlistAPIv1.util.invalidateTags(['Playlist']));
    onDismiss?.();
    navigate('/playlists');
  };

  return (
    <SaveProvisionedResourceForm
      resource={playlist}
      resourceType="playlist"
      resourceName={playlist.metadata?.name ?? ''}
      title={playlist.spec?.title ?? ''}
      branchPrefix="playlist"
      body={{
        apiVersion: playlist.apiVersion,
        kind: playlist.kind,
        metadata: { name: playlist.metadata?.name },
        spec: playlist.spec,
      }}
      errorMessage={t('playlist-edit.save-provisioned.error-saving', 'Failed to save playlist')}
      readOnlyMessage={t(
        'playlist-edit.save-provisioned.read-only-message',
        'To edit this playlist, please update the file in your repository directly.'
      )}
      onDismiss={onDismiss}
      onWriteSuccess={goToPlaylists}
      onBranchSuccess={goToPlaylists}
    />
  );
}
