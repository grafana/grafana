import { useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { type NavModelItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { Page } from 'app/core/components/Page/Page';
import { ManagedResourceBadge } from 'app/features/provisioning/components/ManagedResourceBadge';
import { SaveProvisionedResourceDrawer } from 'app/features/provisioning/components/Shared/SaveProvisionedResourceDrawer';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { useResourceRepositorySelection } from 'app/features/provisioning/hooks/useResourceRepositorySelection';
import {
  getManagerIdentity,
  getManagerKind,
  getSourcePath,
  isManaged,
  isManagedByRepository,
  isManagedResourceReadOnly,
} from 'app/features/provisioning/utils/managedResource';
import { resourceKindInfos } from 'app/features/provisioning/utils/resourceKinds';

import { type Playlist, useGetPlaylistQuery, useReplacePlaylistMutation } from '../../api/clients/playlist/v1';

import { PlaylistForm } from './PlaylistForm';
import { PLAYLISTS_URL } from './utils';

export interface RouteParams {
  uid: string;
}

export const PlaylistEditPage = () => {
  const { uid = '' } = useParams();
  const { data, isLoading, isError, error } = useGetPlaylistQuery({ name: uid });
  const [replacePlaylist] = useReplacePlaylistMutation();
  const { isAvailable, repositories } = useResourceRepositorySelection(resourceKindInfos.playlist);
  const isRepositoryManaged = Boolean(data && isManagedByRepository(data));
  // A repository-managed playlist is read-only when its repository has no write workflow; any other
  // manager says so on the resource itself.
  const { isReadOnlyRepo } = useGetResourceRepositoryView({
    name: isRepositoryManaged && data ? getManagerIdentity(data) : undefined,
  });
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
            <ManagedResourceBadge
              managerKind={getManagerKind(data)}
              name={getManagerIdentity(data)}
              isReadOnly={isRepositoryManaged ? isReadOnlyRepo : isManagedResourceReadOnly(data)}
              repositoryName={getManagerIdentity(data)}
              sourcePath={getSourcePath(data)}
            />
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
