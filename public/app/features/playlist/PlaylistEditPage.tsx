import { useParams } from 'react-router-dom-v5-compat';

import { NavModelItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { t, Trans } from 'app/core/internationalization';

import { Playlist, useGetPlaylistQuery, useReplacePlaylistMutation } from '../../api/clients/playlist';

import { PlaylistForm } from './PlaylistForm';

export interface RouteParams {
  uid: string;
}

export const PlaylistEditPage = () => {
  const { uid = '' } = useParams();
  const { data, isLoading, isError, error } = useGetPlaylistQuery({ name: uid });
  const [replacePlaylist] = useReplacePlaylistMutation();

  const onSubmit = async (playlist: Playlist) => {
    replacePlaylist({
      name: playlist.metadata.name ?? '',
      playlist,
    });
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
      <Page.Contents isLoading={isLoading}>
        {isError && (
          <div>
            <Trans i18nKey="playlist-edit.error-prefix">Error loading playlist:</Trans>
            {JSON.stringify(error)}
          </div>
        )}
        {data && <PlaylistForm onSubmit={onSubmit} playlist={data} />}
      </Page.Contents>
    </Page>
  );
};

export default PlaylistEditPage;
