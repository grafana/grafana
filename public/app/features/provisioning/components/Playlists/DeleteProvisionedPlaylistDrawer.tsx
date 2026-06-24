import { useNavigate } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
import { type Playlist, playlistAPIv1 } from 'app/api/clients/playlist/v1';
import { useDispatch } from 'app/types/store';

import { resourceKindInfos } from '../../utils/resourceKinds';
import { SaveProvisionedResourceDrawer } from '../Shared/SaveProvisionedResourceDrawer';

const playlistKind = resourceKindInfos.playlist;

interface DeleteProvisionedPlaylistDrawerProps {
  /** The repository-managed playlist to delete from its repository. */
  playlist: Playlist;
  onDismiss?: () => void;
}

/** Commits the deletion of a repository-managed playlist to git via the shared provisioning drawer. */
export function DeleteProvisionedPlaylistDrawer({ playlist, onDismiss }: DeleteProvisionedPlaylistDrawerProps) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const invalidatePlaylists = () => dispatch(playlistAPIv1.util.invalidateTags(['Playlist']));

  const goToPlaylists = () => {
    invalidatePlaylists();
    navigate(playlistKind.listRoute);
  };

  return (
    <SaveProvisionedResourceDrawer
      resource={playlist}
      resourceType="playlist"
      resourceName={playlist.metadata?.name ?? ''}
      title={playlist.spec?.title ?? ''}
      drawerTitle={t('playlist-page.delete-provisioned.drawer-title', 'Delete provisioned playlist')}
      action="delete"
      onDismiss={onDismiss}
      onWriteSuccess={goToPlaylists}
      onBranchSuccess={invalidatePlaylists}
    />
  );
}
