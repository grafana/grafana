import { useState } from 'react';

import { NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';

import { Playlist, useCreatePlaylistMutation } from '../../api/clients/playlist/v0alpha1';

import { PlaylistForm } from './PlaylistForm';
import { getDefaultPlaylist } from './utils';

export const PlaylistNewPage = () => {
  const [playlist] = useState<Playlist>(getDefaultPlaylist());
  const [createPlaylist] = useCreatePlaylistMutation();

  const onSubmit = async (playlist: Playlist) => {
    await createPlaylist({
      playlist,
    });
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
        <PlaylistForm onSubmit={onSubmit} playlist={playlist} />
      </Page.Contents>
    </Page>
  );
};

export default PlaylistNewPage;
