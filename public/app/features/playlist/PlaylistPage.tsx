import React, { useMemo, useState } from 'react';
import { useAsync } from 'react-use';

import { ConfirmModal } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { Page } from 'app/core/components/Page/Page';
import PageActionBar from 'app/core/components/PageActionBar/PageActionBar';
import { t } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';

import { EmptyQueryListBanner } from './EmptyQueryListBanner';
import { PlaylistPageList } from './PlaylistPageList';
import { StartModal } from './StartModal';
import { deletePlaylist, getAllPlaylist, searchPlaylists } from './api';
import { Playlist } from './types';

export const PlaylistPage = () => {
  const [forcePlaylistsFetch, setForcePlaylistsFetch] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const allPlaylists = useAsync(() => getAllPlaylist(), [forcePlaylistsFetch]);
  const playlists = useMemo(() => searchPlaylists(allPlaylists.value ?? [], searchQuery), [searchQuery, allPlaylists]);

  const [startPlaylist, setStartPlaylist] = useState<Playlist | undefined>();
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | undefined>();

  const hasPlaylists = playlists && playlists.length > 0;
  const onDismissDelete = () => setPlaylistToDelete(undefined);
  const onDeletePlaylist = () => {
    if (!playlistToDelete) {
      return;
    }
    deletePlaylist(playlistToDelete.uid).finally(() => {
      setForcePlaylistsFetch(forcePlaylistsFetch + 1);
      setPlaylistToDelete(undefined);
    });
  };

  const emptyListBanner = (
    <EmptyListCTA
      title={t('playlist-page.empty.title', 'There are no playlists created yet')}
      buttonIcon="plus"
      buttonLink="playlists/new"
      buttonTitle={t('playlist-page.empty.button', 'Create Playlist')}
      buttonDisabled={!contextSrv.isEditor}
      proTip={t('playlist-page.empty.pro-tip', 'You can use playlists to cycle dashboards on TVs without user control')}
      proTipLink="http://docs.grafana.org/reference/playlist/"
      proTipLinkTitle={t('playlist-page.empty.proTipLinkTitle', 'Learn more')}
      proTipTarget="_blank"
    />
  );

  const showSearch = playlists.length > 0 || searchQuery.length > 0;

  return (
    <Page navId="dashboards/playlists">
      <Page.Contents isLoading={allPlaylists.loading}>
        {showSearch && (
          <PageActionBar
            searchQuery={searchQuery}
            linkButton={
              contextSrv.isEditor
                ? { title: t('playlist-page.action.title', 'New playlist'), href: '/playlists/new' }
                : undefined
            }
            setSearchQuery={setSearchQuery}
          />
        )}

        {!hasPlaylists && searchQuery ? (
          <EmptyQueryListBanner />
        ) : (
          <PlaylistPageList
            playlists={playlists}
            setStartPlaylist={setStartPlaylist}
            setPlaylistToDelete={setPlaylistToDelete}
          />
        )}
        {!showSearch && emptyListBanner}
        {playlistToDelete && (
          <ConfirmModal
            title={playlistToDelete.name}
            confirmText={t('playlist-page.confirmText', 'Delete')}
            body={t('playlist-page.confirmBody', 'Are you sure you want to delete {{name}} playlist?', {
              name: playlistToDelete.name,
            })}
            onConfirm={onDeletePlaylist}
            isOpen={Boolean(playlistToDelete)}
            onDismiss={onDismissDelete}
          />
        )}
        {startPlaylist && <StartModal playlist={startPlaylist} onDismiss={() => setStartPlaylist(undefined)} />}
      </Page.Contents>
    </Page>
  );
};

export default PlaylistPage;
