import React from 'react';
import { useAsync } from 'react-use';

import { locationService } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { PlaylistForm } from './PlaylistForm';
import { getPlaylist, updatePlaylist } from './api';
import { getPlaylistStyles } from './styles';
import { Playlist } from './types';

export interface RouteParams {
  uid: string;
}

interface Props extends GrafanaRouteComponentProps<RouteParams> {}

export const PlaylistEditPage = ({ match }: Props) => {
  const styles = useStyles2(getPlaylistStyles);
  const playlist = useAsync(() => getPlaylist(match.params.uid), [match.params]);

  const onSubmit = async (playlist: Playlist) => {
    await updatePlaylist(match.params.uid, playlist);
    locationService.push('/playlists');
  };

  return (
    <Page navId="dashboards/playlists">
      <Page.Contents isLoading={playlist.loading}>
        <h3 className={styles.subHeading}>Edit playlist</h3>

        {playlist.error && <div>Error loading playlist: {JSON.stringify(playlist.error)}</div>}

        {playlist.value && (
          <>
            <p className={styles.description}>
              A playlist rotates through a pre-selected list of dashboards. A playlist can be a great way to build
              situational awareness, or just show off your metrics to your team or visitors.
            </p>

            <PlaylistForm onSubmit={onSubmit} playlist={playlist.value} />
          </>
        )}
      </Page.Contents>
    </Page>
  );
};

export default PlaylistEditPage;
