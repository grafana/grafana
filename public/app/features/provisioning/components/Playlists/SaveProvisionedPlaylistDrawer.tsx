import { useNavigate } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
import { type Playlist, playlistAPIv1 } from 'app/api/clients/playlist/v1';
import { useDispatch } from 'app/types/store';

import { SaveProvisionedResourceDrawer } from '../Shared/SaveProvisionedResourceDrawer';

interface SaveProvisionedPlaylistDrawerProps {
  /** The playlist with the edited spec that should be committed to the repository. */
  playlist: Playlist;
  onDismiss?: () => void;
}

export function SaveProvisionedPlaylistDrawer({ playlist, onDismiss }: SaveProvisionedPlaylistDrawerProps) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const goToPlaylists = () => {
    // The playlist list is managed elsewhere; invalidate so the change shows up there.
    dispatch(playlistAPIv1.util.invalidateTags(['Playlist']));
    onDismiss?.();
    navigate('/playlists');
  };

  return (
    <SaveProvisionedResourceDrawer
      resource={playlist}
      resourceType="playlist"
      resourceName={playlist.metadata?.name ?? ''}
      title={playlist.spec?.title ?? ''}
      drawerTitle={t('playlist-edit.save-provisioned.drawer-title', 'Save provisioned playlist')}
      branchPrefix="playlist"
      body={{
        apiVersion: playlist.apiVersion,
        kind: playlist.kind,
        metadata: { name: playlist.metadata?.name },
        spec: playlist.spec,
      }}
      onDismiss={onDismiss}
      onWriteSuccess={goToPlaylists}
      onBranchSuccess={goToPlaylists}
    />
  );
}
