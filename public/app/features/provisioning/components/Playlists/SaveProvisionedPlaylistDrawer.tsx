import { customAlphabet } from 'nanoid';
import { useMemo } from 'react';
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
import { resourceKindInfos } from '../../utils/resourceKinds';
import { SaveProvisionedResourceDrawer } from '../Shared/SaveProvisionedResourceDrawer';
import { slugifyForFilename } from '../utils/path';

const playlistKind = resourceKindInfos.playlist;

// New playlists need a stable k8s name in the committed file (unlike the direct API, the
// provisioning write validates the resource has one). Generate an RFC 1123-safe UID.
const generatePlaylistName = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12);

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

/** Builds the repository file path for a new playlist from its title, mirroring the dashboard slug. */
function getNewPlaylistPath(title: string): string {
  return `${slugifyForFilename(title) || 'playlist'}.json`;
}

export function SaveProvisionedPlaylistDrawer({
  playlist,
  repositoryName,
  isNew = false,
  onDismiss,
}: SaveProvisionedPlaylistDrawerProps) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // A new playlist has no name yet; generate one once for the lifetime of the drawer.
  const generatedName = useMemo(() => generatePlaylistName(), []);
  const resourceName = isNew ? generatedName : (playlist.metadata?.name ?? '');

  const goToPlaylists = () => {
    // The playlist list is managed elsewhere; invalidate so the change shows up there.
    dispatch(playlistAPIv1.util.invalidateTags(['Playlist']));
    onDismiss?.();
    navigate(playlistKind.listRoute);
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
      resourceName={resourceName}
      title={playlist.spec?.title ?? ''}
      drawerTitle={t('playlist-edit.save-provisioned.drawer-title', 'Save provisioned playlist')}
      isNew={isNew}
      action={isNew ? 'create' : 'update'}
      body={{
        apiVersion: playlist.apiVersion,
        kind: playlist.kind,
        metadata: { name: resourceName },
        spec: playlist.spec,
      }}
      onDismiss={onDismiss}
      onWriteSuccess={goToPlaylists}
      onBranchSuccess={goToPlaylists}
    />
  );
}
