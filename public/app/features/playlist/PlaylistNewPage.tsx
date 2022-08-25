import React, { useState } from 'react';

import { locationService } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { PlaylistForm } from './PlaylistForm';
import { createPlaylist, getDefaultPlaylist } from './api';
import { getPlaylistStyles } from './styles';
import { Playlist } from './types';

export const PlaylistNewPage = () => {
  const styles = useStyles2(getPlaylistStyles);
  const [playlist] = useState<Playlist>(getDefaultPlaylist());

  const onSubmit = async (playlist: Playlist) => {
    await createPlaylist(playlist);
    locationService.push('/playlists');
  };

  return (
    <Page navId="dashboards/playlists">
      <Page.Contents>
        <h3 className={styles.subHeading}>New Playlist</h3>

        <p className={styles.description}>
          A playlist rotates through a pre-selected list of dashboards. A playlist can be a great way to build
          situational awareness, or just show off your metrics to your team or visitors.
        </p>

        <PlaylistForm onSubmit={onSubmit} playlist={playlist} />
      </Page.Contents>
    </Page>
  );
};

export default PlaylistNewPage;
