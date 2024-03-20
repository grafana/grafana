import React, { useMemo, useState } from 'react';
import { useAsync } from 'react-use';

import { ConfirmModal, LinkButton, TextLink } from '@grafana/ui';
import { EmptySearchState } from '@grafana/ui/src/components/EmptyState/EmptySearchState/EmptySearchState';
import { EmptyState } from '@grafana/ui/src/components/EmptyState/EmptyState';
import { Page } from 'app/core/components/Page/Page';
import PageActionBar from 'app/core/components/PageActionBar/PageActionBar';
import { Trans, t } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';

import { PlaylistPageList } from './PlaylistPageList';
import { StartModal } from './StartModal';
import { getPlaylistAPI, searchPlaylists } from './api';
import { Playlist } from './types';

export const PlaylistPage = () => {
  const api = getPlaylistAPI();
  const [forcePlaylistsFetch, setForcePlaylistsFetch] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const allPlaylists = useAsync(() => api.getAllPlaylist(), [forcePlaylistsFetch]);
  const playlists = useMemo(() => searchPlaylists(allPlaylists.value ?? [], searchQuery), [searchQuery, allPlaylists]);

  const [startPlaylist, setStartPlaylist] = useState<Playlist | undefined>();
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | undefined>();

  const hasPlaylists = playlists && playlists.length > 0;
  const onDismissDelete = () => setPlaylistToDelete(undefined);
  const onDeletePlaylist = () => {
    if (!playlistToDelete) {
      return;
    }
    api.deletePlaylist(playlistToDelete.uid).finally(() => {
      setForcePlaylistsFetch(forcePlaylistsFetch + 1);
      setPlaylistToDelete(undefined);
    });
  };

  const showSearch = allPlaylists.loading || playlists.length > 0 || searchQuery.length > 0;

  return (
    <Page
      actions={
        contextSrv.isEditor && playlists.length > 0 ? (
          <LinkButton href="/playlists/new">
            <Trans i18nKey="playlist-page.create-button.title">New playlist</Trans>
          </LinkButton>
        ) : undefined
      }
      navId="dashboards/playlists"
    >
      <Page.Contents>
        {showSearch && <PageActionBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}

        {allPlaylists.loading ? (
          <PlaylistPageList.Skeleton />
        ) : (
          <>
            {!hasPlaylists && searchQuery ? (
              <EmptySearchState message="No playlist found!" />
            ) : (
              <PlaylistPageList
                playlists={playlists}
                setStartPlaylist={setStartPlaylist}
                setPlaylistToDelete={setPlaylistToDelete}
              />
            )}
            {!showSearch && (
              <EmptyState
                buttonHref="playlists/new"
                buttonLabel={contextSrv.isEditor ? t('playlist-page.empty.button', 'Create Playlist') : undefined}
                message={t('playlist-page.empty.title', 'There are no playlists created yet')}
              >
                <Trans i18nKey="playlist-page.empty.pro-tip">
                  You can use playlists to cycle dashboards on TVs without user control.{' '}
                  <TextLink external href="https://docs.grafana.org/reference/playlist/">
                    Learn more
                  </TextLink>
                </Trans>
              </EmptyState>
            )}
            {playlistToDelete && (
              <ConfirmModal
                title={playlistToDelete.name}
                confirmText={t('playlist-page.delete-modal.confirm-text', 'Delete')}
                body={t('playlist-page.delete-modal.body', 'Are you sure you want to delete {{name}} playlist?', {
                  name: playlistToDelete.name,
                })}
                onConfirm={onDeletePlaylist}
                isOpen={Boolean(playlistToDelete)}
                onDismiss={onDismissDelete}
              />
            )}
            {startPlaylist && <StartModal playlist={startPlaylist} onDismiss={() => setStartPlaylist(undefined)} />}
          </>
        )}
      </Page.Contents>
    </Page>
  );
};

export default PlaylistPage;
