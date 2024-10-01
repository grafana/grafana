import { useParams } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { NavModelItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { t, Trans } from 'app/core/internationalization';

import { PlaylistForm } from './PlaylistForm';
import { getPlaylistAPI } from './api';
import { Playlist } from './types';

export interface RouteParams {
  uid: string;
}

export const PlaylistEditPage = () => {
  const { uid = '' } = useParams();
  const api = getPlaylistAPI();
  const playlist = useAsync(() => api.getPlaylist(uid), [uid]);

  const onSubmit = async (playlist: Playlist) => {
    await api.updatePlaylist(playlist);
    locationService.push('/playlists');
  };

  const pageNav: NavModelItem = {
    text: t('playlist-edit.title', 'Edit playlist'),
    subTitle: t(
      'playlist-edit.sub-title',
      'A playlist rotates through a pre-selected list of dashboards. A playlist can be a great way to build situational awareness, or just show off your metrics to your team or visitors.'
    ),
  };

  return (
    <Page navId="dashboards/playlists" pageNav={pageNav}>
      <Page.Contents isLoading={playlist.loading}>
        {playlist.error && (
          <div>
            <Trans i18nKey="playlist-edit.error-prefix">Error loading playlist:</Trans>
            {JSON.stringify(playlist.error)}
          </div>
        )}
        {playlist.value && <PlaylistForm onSubmit={onSubmit} playlist={playlist.value} />}
      </Page.Contents>
    </Page>
  );
};

export default PlaylistEditPage;
