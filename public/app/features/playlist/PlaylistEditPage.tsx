import React, { FC } from 'react';

import { locationService } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { GrafanaRouteComponentProps } from '../../core/navigation/types';

import { PlaylistForm } from './PlaylistForm';
import { updatePlaylist } from './api';
import { getPlaylistStyles } from './styles';
import { Playlist } from './types';
import { usePlaylist } from './usePlaylist';

export interface RouteParams {
  uid: string;
}

interface Props extends GrafanaRouteComponentProps<RouteParams> {}

export const PlaylistEditPage: FC<Props> = ({ match }) => {
  const styles = useStyles2(getPlaylistStyles);
  const { playlist, loading } = usePlaylist(match.params.uid);
  const onSubmit = async (playlist: Playlist) => {
    await updatePlaylist(match.params.uid, playlist);
    locationService.push('/playlists');
  };

  return (
    <Page navId="dashboards/playlists">
      <Page.Contents isLoading={loading}>
        <h3 className={styles.subHeading}>Edit playlist</h3>

        <p className={styles.description}>
          A playlist rotates through a pre-selected list of dashboards. A playlist can be a great way to build
          situational awareness, or just show off your metrics to your team or visitors.
        </p>

        <PlaylistForm onSubmit={onSubmit} playlist={playlist} />
      </Page.Contents>
    </Page>
  );
};

export default PlaylistEditPage;
