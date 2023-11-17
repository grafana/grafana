import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { PlaylistCard } from './PlaylistCard';
import { Playlist } from './types';

interface Props {
  setStartPlaylist: (playlistItem: Playlist) => void;
  setPlaylistToDelete: (playlistItem: Playlist) => void;
  playlists: Playlist[];
}

export const PlaylistPageList = ({ playlists, setStartPlaylist, setPlaylistToDelete }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <ul className={styles.list}>
      {playlists.map((playlist: Playlist) => (
        <li className={styles.listItem} key={playlist.uid}>
          <PlaylistCard
            playlist={playlist}
            setStartPlaylist={setStartPlaylist}
            setPlaylistToDelete={setPlaylistToDelete}
          />
        </li>
      ))}
    </ul>
  );
};

const PlaylistPageListSkeleton = () => {
  const styles = useStyles2(getStyles);
  return (
    <div data-testid="playlist-page-list-skeleton" className={styles.list}>
      <PlaylistCard.Skeleton />
      <PlaylistCard.Skeleton />
      <PlaylistCard.Skeleton />
    </div>
  );
};

PlaylistPageList.Skeleton = PlaylistPageListSkeleton;

function getStyles(theme: GrafanaTheme2) {
  return {
    list: css({
      display: 'grid',
    }),
    listItem: css({
      listStyle: 'none',
    }),
  };
}
