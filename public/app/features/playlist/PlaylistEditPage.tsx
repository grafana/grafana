import React from 'react';
import { useAsync } from 'react-use';

import { NavModelItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { PlaylistForm } from './PlaylistForm';
import { getPlaylist, updatePlaylist } from './api';
import { Playlist } from './types';

export interface RouteParams {
  uid: string;
}

interface Props extends GrafanaRouteComponentProps<RouteParams> {}

export const PlaylistEditPage = ({ match }: Props) => {
  const playlist = useAsync(() => getPlaylist(match.params.uid), [match.params]);

  const onSubmit = async (playlist: Playlist) => {
    await updatePlaylist(match.params.uid, playlist);
    locationService.push('/playlists');
  };

  const pageNav: NavModelItem = {
    text: 'Edit playlist',
    subTitle:
      'A playlist rotates through a pre-selected list of dashboards. A playlist can be a great way to build situational awareness, or just show off your metrics to your team or visitors.',
  };

  return (
    <Page navId="dashboards/playlists" pageNav={pageNav}>
      <Page.Contents isLoading={playlist.loading}>
        {playlist.error && <div>Error loading playlist: {JSON.stringify(playlist.error)}</div>}

        {playlist.value && <PlaylistForm onSubmit={onSubmit} playlist={playlist.value} />}
      </Page.Contents>
    </Page>
  );
};

export default PlaylistEditPage;
