import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { type NavModelItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { ManagedBadge } from 'app/features/provisioning/components/ManagedBadge';
import { SaveProvisionedPlaylistDrawer } from 'app/features/provisioning/components/Playlists/SaveProvisionedPlaylistDrawer';
import { SourceLink } from 'app/features/provisioning/components/SourceLink';
import {
  getManagerIdentity,
  getManagerKind,
  getSourcePath,
  isManaged,
  isManagedByRepository,
} from 'app/features/provisioning/utils/managedResource';

import { type Playlist, useGetPlaylistQuery, useReplacePlaylistMutation } from '../../api/clients/playlist/v1';

import { PlaylistForm, type PlaylistRepositorySelect } from './PlaylistForm';
import { usePlaylistProvisioning } from './usePlaylistProvisioning';

export interface RouteParams {
  uid: string;
}

export const PlaylistEditPage = () => {
  const { uid = '' } = useParams();
  const { data, isLoading, isError, error } = useGetPlaylistQuery({ name: uid });
  const [replacePlaylist] = useReplacePlaylistMutation();
  const { isAvailable, repositories } = usePlaylistProvisioning();
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

  // The repository can't be changed after creation, so the selector is read-only on edit. It shows
  // the managing repository (or "no repository" for an unmanaged playlist).
  const repositorySelect = useMemo<PlaylistRepositorySelect | undefined>(() => {
    if (!isAvailable || !data) {
      return undefined;
    }
    const managedRepo = isManagedByRepository(data) ? (getManagerIdentity(data) ?? '') : '';
    const repoOptions = repositories.map((repo) => ({ label: repo.title || repo.name, value: repo.name }));
    // Surface an orphaned/inaccessible repository so the locked value still renders.
    if (managedRepo && !repoOptions.some((option) => option.value === managedRepo)) {
      repoOptions.push({ label: managedRepo, value: managedRepo });
    }
    return {
      options: [
        { label: t('playlist-edit.form.repository-none', 'Grafana (no repository)'), value: '' },
        ...repoOptions,
      ],
      value: managedRepo,
      onChange: () => {},
      readOnly: true,
    };
  }, [isAvailable, data, repositories]);

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
        {data && <PlaylistForm onSubmit={onSubmit} playlist={data} repositorySelect={repositorySelect} />}
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
