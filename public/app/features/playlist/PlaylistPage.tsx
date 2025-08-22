import { useMemo, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { ConfirmModal, EmptyState, LinkButton, TextLink } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import PageActionBar from 'app/core/components/PageActionBar/PageActionBar';
import { contextSrv } from 'app/core/services/context_srv';

import { Playlist, useDeletePlaylistMutation, useListPlaylistQuery } from '../../api/clients/playlist/v0alpha1';

import { PlaylistPageList } from './PlaylistPageList';
import { StartModal } from './StartModal';
import { searchPlaylists } from './utils';

export const PlaylistPage = () => {
  const { data, isLoading } = useListPlaylistQuery({});
  const [deletePlaylist] = useDeletePlaylistMutation();
  const [searchQuery, setSearchQuery] = useState('');
  const allPlaylists = useMemo(() => data?.items ?? [], [data?.items]);
  const playlists = useMemo(() => searchPlaylists(allPlaylists, searchQuery), [searchQuery, allPlaylists]);

  const [startPlaylist, setStartPlaylist] = useState<Playlist | undefined>();
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | undefined>();

  const hasPlaylists = playlists && playlists.length > 0;
  const onDismissDelete = () => setPlaylistToDelete(undefined);
  const onDeletePlaylist = () => {
    if (!playlistToDelete) {
      return;
    }
    deletePlaylist({
      name: playlistToDelete.metadata?.name ?? '',
    }).finally(() => {
      setPlaylistToDelete(undefined);
    });
  };

  const showSearch = isLoading || playlists.length > 0 || searchQuery.length > 0;

  return (
    <Page
      actions={
        contextSrv.isEditor && showSearch ? (
          <LinkButton href="/playlists/new">
            <Trans i18nKey="playlist-page.create-button.title">New playlist</Trans>
          </LinkButton>
        ) : undefined
      }
      navId="dashboards/playlists"
    >
      <Page.Contents>
        {showSearch && <PageActionBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}

        {isLoading ? (
          <PlaylistPageList.Skeleton />
        ) : (
          <>
            {!hasPlaylists && searchQuery ? (
              <EmptyState variant="not-found" message={t('playlists.empty-state.message', 'No playlists found')} />
            ) : (
              <PlaylistPageList
                playlists={playlists}
                setStartPlaylist={setStartPlaylist}
                setPlaylistToDelete={setPlaylistToDelete}
              />
            )}
            {!showSearch && (
              <EmptyState
                variant="call-to-action"
                button={
                  <LinkButton disabled={!contextSrv.isEditor} href="playlists/new" icon="plus" size="lg">
                    <Trans i18nKey="playlist-page.empty.button">Create playlist</Trans>
                  </LinkButton>
                }
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
                title={playlistToDelete.spec?.title ?? ''}
                confirmText={t('playlist-page.delete-modal.confirm-text', 'Delete')}
                body={t('playlist-page.delete-modal.body', 'Are you sure you want to delete {{name}} playlist?', {
                  name: playlistToDelete.spec?.title,
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
