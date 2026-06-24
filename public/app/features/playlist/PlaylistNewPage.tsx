import { useMemo, useState } from 'react';

import { type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';

import { type Playlist, useCreatePlaylistMutation } from '../../api/clients/playlist/v1';
import { SaveProvisionedPlaylistDrawer } from '../provisioning/components/Playlists/SaveProvisionedPlaylistDrawer';

import { PlaylistForm, type PlaylistRepositorySelect } from './PlaylistForm';
import { usePlaylistProvisioning } from './usePlaylistProvisioning';
import { getDefaultPlaylist } from './utils';

export const PlaylistNewPage = () => {
  const [playlist] = useState<Playlist>(getDefaultPlaylist());
  const [createPlaylist] = useCreatePlaylistMutation();
  const { isAvailable, repositories } = usePlaylistProvisioning();
  // Empty string = save to Grafana; a repository name routes the save through the provisioning drawer.
  const [selectedRepository, setSelectedRepository] = useState('');
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

  const repositorySelect = useMemo<PlaylistRepositorySelect | undefined>(() => {
    if (!isAvailable) {
      return undefined;
    }
    return {
      options: [
        { label: t('playlist-edit.form.repository-none', 'Grafana (no repository)'), value: '' },
        ...repositories.map((repo) => ({ label: repo.title || repo.name, value: repo.name })),
      ],
      value: selectedRepository,
      onChange: setSelectedRepository,
    };
  }, [isAvailable, repositories, selectedRepository]);

  const pageNav: NavModelItem = {
    text: t('playlist.playlist-new-page.page-nav.text.new-playlist', 'New playlist'),
    subTitle:
      'A playlist rotates through a pre-selected list of dashboards. A playlist can be a great way to build situational awareness, or just show off your metrics to your team or visitors.',
  };

  return (
    <Page navId="dashboards/playlists" pageNav={pageNav}>
      <Page.Contents>
        <PlaylistForm onSubmit={onSubmit} playlist={playlist} repositorySelect={repositorySelect} />
      </Page.Contents>
      {provisionedPlaylist && selectedRepository && (
        <SaveProvisionedPlaylistDrawer
          playlist={provisionedPlaylist}
          repositoryName={selectedRepository}
          isNew
          onDismiss={() => setProvisionedPlaylist(undefined)}
        />
      )}
    </Page>
  );
};

export default PlaylistNewPage;
