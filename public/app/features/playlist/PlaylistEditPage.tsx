import { useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { type NavModelItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { ManagedBadge } from 'app/features/provisioning/components/ManagedBadge';
import { SourceLink } from 'app/features/provisioning/components/SourceLink';
import {
  getManagerIdentity,
  getManagerKind,
  getSourcePath,
  isManaged,
  isManagedByRepository,
} from 'app/features/provisioning/utils/managedResource';

import { type Playlist, useGetPlaylistQuery, useReplacePlaylistMutation } from '../../api/clients/playlist/v1';
import { SaveProvisionedPlaylistDrawer } from '../provisioning/components/Playlists/SaveProvisionedPlaylistDrawer';

import { PlaylistForm } from './PlaylistForm';

export interface RouteParams {
  uid: string;
}

export const PlaylistEditPage = () => {
  const { uid = '' } = useParams();
  const { data, isLoading, isError, error } = useGetPlaylistQuery({ name: uid });
  const [replacePlaylist] = useReplacePlaylistMutation();
  // Holds the edited playlist while the provisioning save drawer is open.
  const [provisionedPlaylist, setProvisionedPlaylist] = useState<Playlist | undefined>();

  const onSubmit = async (playlist: Playlist) => {
    // Repository-managed playlists are committed to git via the save drawer instead of
    // being written directly through the playlist API.
    if (isManagedByRepository(playlist)) {
      setProvisionedPlaylist(playlist);
      return;
    }

    replacePlaylist({
      name: playlist.metadata?.name ?? '',
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

  const renderTitle = (title: string) => (
    <Stack direction="row" gap={1} alignItems="center" wrap>
      <h1>{title}</h1>
      {data && isManaged(data) && <ManagedBadge managerKind={getManagerKind(data)} name={getManagerIdentity(data)} />}
      {data && isManagedByRepository(data) && (
        <SourceLink repositoryName={getManagerIdentity(data)} sourcePath={getSourcePath(data)} />
      )}
    </Stack>
  );

  return (
    <Page navId="dashboards/playlists" pageNav={pageNav} renderTitle={renderTitle}>
      <Page.Contents isLoading={isLoading}>
        {isError && (
          <div>
            <Trans i18nKey="playlist-edit.error-prefix">Error loading playlist:</Trans>
            {JSON.stringify(error)}
          </div>
        )}
        {data && <PlaylistForm onSubmit={onSubmit} playlist={data} />}
      </Page.Contents>
      {provisionedPlaylist && (
        <SaveProvisionedPlaylistDrawer
          playlist={provisionedPlaylist}
          onDismiss={() => setProvisionedPlaylist(undefined)}
        />
      )}
    </Page>
  );
};

export default PlaylistEditPage;
