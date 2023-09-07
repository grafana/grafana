import React from 'react';
import { useAsync } from 'react-use';

import { NavModelItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { t, Trans } from 'app/core/internationalization';
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
    text: t('playlist-edit.title', 'Edit playlist'),
    subTitle: t(
      'playlist-edit.subTitle',
      'A playlist rotates through a pre-selected list of dashboards. A playlist can be a great way to build situational awareness, or just show off your metrics to your team or visitors.'
    ),
  };

  return (
    <Page navId="dashboards/playlists" pageNav={pageNav}>
      <Page.Contents isLoading={playlist.loading}>
        {playlist.error && (
          <Trans i18nKey="playlist-edit.errorPrefix">
            <div> Error loading playlist: {JSON.stringify(playlist.error)}</div>
          </Trans>
        )}
        {playlist.value && (
          <Trans i18nKey="playlist-edit.value">
            <PlaylistForm onSubmit={onSubmit} playlist={playlist.value} />
          </Trans>
        )}
      </Page.Contents>
    </Page>
  );
};

export default PlaylistEditPage;
