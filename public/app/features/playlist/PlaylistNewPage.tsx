import { useState } from 'react';

import { type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';

import { type Playlist, useCreatePlaylistMutation } from '../../api/clients/playlist/v1';
import { SaveProvisionedResourceDrawer } from '../provisioning/components/Shared/SaveProvisionedResourceDrawer';
import { useResourceRepositorySelection } from '../provisioning/hooks/useResourceRepositorySelection';
import { resourceKindInfos } from '../provisioning/utils/resourceKinds';

import { PlaylistForm } from './PlaylistForm';
import { getDefaultPlaylist, useInvalidatePlaylists } from './utils';

export const PlaylistNewPage = () => {
  const [playlist] = useState<Playlist>(getDefaultPlaylist());
  const [createPlaylist] = useCreatePlaylistMutation();
  const { isAvailable, repositories } = useResourceRepositorySelection(resourceKindInfos.playlist);
  const invalidatePlaylists = useInvalidatePlaylists();
  // No selection = save to Grafana; a repository name routes the save through the provisioning drawer.
  const [selectedRepository, setSelectedRepository] = useState<string | undefined>(undefined);
  // Holds the playlist while the provisioning save drawer is open.
  const [provisionedPlaylist, setProvisionedPlaylist] = useState<Playlist | undefined>();

  const onSubmit = async (playlist: Playlist) => {
    if (selectedRepository) {
      setProvisionedPlaylist(playlist);
      return;
    }

    await createPlaylist({ playlist });
    locationService.push('/playlists');
  };

  const pageNav: NavModelItem = {
    text: t('playlist.playlist-new-page.page-nav.text.new-playlist', 'New playlist'),
    subTitle:
      'A playlist rotates through a pre-selected list of dashboards. A playlist can be a great way to build situational awareness, or just show off your metrics to your team or visitors.',
  };

  return (
    <Page navId="dashboards/playlists" pageNav={pageNav}>
      <Page.Contents>
        <PlaylistForm
          onSubmit={onSubmit}
          playlist={playlist}
          showRepositorySelect={isAvailable}
          repositories={repositories}
          selectedRepository={selectedRepository}
          onRepositoryChange={setSelectedRepository}
        />
      </Page.Contents>
      {provisionedPlaylist && selectedRepository && (
        <SaveProvisionedResourceDrawer
          kind={resourceKindInfos.playlist}
          resource={provisionedPlaylist}
          action="create"
          title={provisionedPlaylist.spec?.title ?? ''}
          repositoryName={selectedRepository}
          invalidate={invalidatePlaylists}
          onDismiss={() => setProvisionedPlaylist(undefined)}
        />
      )}
    </Page>
  );
};

export default PlaylistNewPage;
