import { useNavigate } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
import { type Playlist, playlistAPIv1 } from 'app/api/clients/playlist/v1';
import {
  AnnoKeyManagerIdentity,
  AnnoKeyManagerKind,
  AnnoKeySourcePath,
  ManagerKind,
} from 'app/features/apiserver/types';
import { useDispatch } from 'app/types/store';

import { type ManagedResource } from '../../utils/managedResource';
import { SaveProvisionedResourceDrawer } from '../Shared/SaveProvisionedResourceDrawer';

interface SaveProvisionedPlaylistDrawerProps {
  /** The playlist with the edited spec that should be committed to the repository. */
  playlist: Playlist;
  /**
   * Repository the playlist should be committed to. Required when `isNew` is set (a new playlist
   * has no manager annotations yet, so the user-selected repository is supplied here). Ignored for
   * an existing repository-managed playlist, which already carries the annotations.
   */
  repositoryName?: string;
  /** Whether this commits a brand-new playlist (create) rather than editing an existing one. */
  isNew?: boolean;
  onDismiss?: () => void;
}

/** Repository file names allow letters, numbers, dashes and underscores; everything else collapses to a dash. */
function getNewPlaylistPath(title: string): string {
  const slug =
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'playlist';
  return `${slug}.json`;
}

export function SaveProvisionedPlaylistDrawer({
  playlist,
  repositoryName,
  isNew = false,
  onDismiss,
}: SaveProvisionedPlaylistDrawerProps) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const goToPlaylists = () => {
    // The playlist list is managed elsewhere; invalidate so the change shows up there.
    dispatch(playlistAPIv1.util.invalidateTags(['Playlist']));
    onDismiss?.();
    navigate('/playlists');
  };

  // A new playlist has no manager annotations yet, so synthesise them for the repository the user
  // picked: the drawer resolves the managing repository and the initial file path from these.
  // An existing repository-managed playlist already carries them.
  const resource: ManagedResource = isNew
    ? {
        metadata: {
          annotations: {
            [AnnoKeyManagerKind]: ManagerKind.Repo,
            [AnnoKeyManagerIdentity]: repositoryName ?? '',
            [AnnoKeySourcePath]: getNewPlaylistPath(playlist.spec?.title ?? ''),
          },
        },
      }
    : playlist;

  return (
    <SaveProvisionedResourceDrawer
      resource={resource}
      resourceType="playlist"
      resourceName={playlist.metadata?.name ?? ''}
      title={playlist.spec?.title ?? ''}
      drawerTitle={t('playlist-edit.save-provisioned.drawer-title', 'Save provisioned playlist')}
      branchPrefix="playlist"
      isNew={isNew}
      action={isNew ? 'create' : 'update'}
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
