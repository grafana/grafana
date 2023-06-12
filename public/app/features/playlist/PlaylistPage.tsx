import React, { useMemo, useState } from 'react';
import { useAsync } from 'react-use';

import { ConfirmModal } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { Page } from 'app/core/components/Page/Page';
import PageActionBar from 'app/core/components/PageActionBar/PageActionBar';
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
      title="There are no playlists created yet"
      buttonIcon="plus"
      buttonLink="playlists/new"
      buttonTitle="Create Playlist"
      buttonDisabled={!contextSrv.isEditor}
      proTip="You can use playlists to cycle dashboards on TVs without user control"
      proTipLink="http://docs.grafana.org/reference/playlist/"
      proTipLinkTitle="Learn more"
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
            linkButton={contextSrv.isEditor ? { title: 'New playlist', href: '/playlists/new' } : undefined}
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
            confirmText="Delete"
            body={`Are you sure you want to delete '${playlistToDelete.name}' playlist?`}
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
