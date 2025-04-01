import { useState } from 'react';

import { NavModelItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';

import { Playlist, useCreatePlaylistMutation } from '../../api/clients/playlist';

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
    text: 'New playlist',
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
