import { useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { type NavModelItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { Page } from 'app/core/components/Page/Page';
import { ManagedResourceBreadcrumbBadge } from 'app/features/provisioning/components/ManagedResourceBreadcrumbBadge';
import { SaveProvisionedResourceDrawer } from 'app/features/provisioning/components/Shared/SaveProvisionedResourceDrawer';
import { useResourceRepositorySelection } from 'app/features/provisioning/hooks/useResourceRepositorySelection';
import { isManaged, isManagedByRepository } from 'app/features/provisioning/utils/managedResource';
import { resourceKindInfos } from 'app/features/provisioning/utils/resourceKinds';

import { type Playlist, useGetPlaylistQuery, useReplacePlaylistMutation } from '../../api/clients/playlist/v1';

import { PlaylistForm } from './PlaylistForm';
import { PLAYLISTS_URL, useCanWritePlaylists } from './utils';

export interface RouteParams {
  uid: string;
}

export const PlaylistEditPage = () => {
  const { uid = '' } = useParams();
  const { data, isLoading, isError, error } = useGetPlaylistQuery({ name: uid });
  const [replacePlaylist] = useReplacePlaylistMutation();
  const { isAvailable, repositories } = useResourceRepositorySelection(resourceKindInfos.playlist);
  // The edit route has no write guard, so a viewer can open it; only a user who could otherwise
  // save needs to be told why they can't.
  const canWrite = useCanWritePlaylists();
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
    locationService.push(PLAYLISTS_URL);
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
      {data && isManaged(data) && (
        <AppChromeUpdate
          breadcrumbActions={
            <ManagedResourceBreadcrumbBadge resource={data} canEdit={canWrite} writesBackToRepository />
          }
        />
      )}
      <Page.Contents isLoading={isLoading}>
        {isError && (
          <div>
            <Trans i18nKey="playlist-edit.error-prefix">Error loading playlist:</Trans>
            {JSON.stringify(error)}
          </div>
        )}
        {data && (
          // Only repository-managed playlists show the (read-only) repository field — the repository
          // can't be changed after creation. Unmanaged playlists are stored in Grafana, so showing an
          // empty, disabled selector would just be confusing.
          <PlaylistForm
            onSubmit={onSubmit}
            playlist={data}
            showRepositorySelect={isAvailable && isManagedByRepository(data)}
            repositories={repositories}
            disableRepositorySelect
          />
        )}
      </Page.Contents>
      {provisionedPlaylist && (
        <SaveProvisionedResourceDrawer
          resource={provisionedPlaylist}
          title={provisionedPlaylist.spec?.title ?? ''}
          action="update"
          redirectUrl={PLAYLISTS_URL}
          onDismiss={() => setProvisionedPlaylist(undefined)}
        />
      )}
    </Page>
  );
};

export default PlaylistEditPage;
