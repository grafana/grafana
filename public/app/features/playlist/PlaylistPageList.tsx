import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SkeletonComponent, useStyles2, attachSkeleton } from '@grafana/ui';

import { PlaylistCard } from './PlaylistCard';
import { Playlist } from './types';

interface Props {
  setStartPlaylist: (playlistItem: Playlist) => void;
  setPlaylistToDelete: (playlistItem: Playlist) => void;
  playlists: Playlist[];
}

const PlaylistPageListComponent = ({ playlists, setStartPlaylist, setPlaylistToDelete }: Props) => {
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

const PlaylistPageListSkeleton: SkeletonComponent = ({ skeletonProps }) => {
  const styles = useStyles2(getStyles);
  return (
    <div data-testid="playlist-page-list-skeleton" className={styles.list} {...skeletonProps}>
      <PlaylistCard.Skeleton />
      <PlaylistCard.Skeleton />
      <PlaylistCard.Skeleton />
    </div>
  );
};

export const PlaylistPageList = attachSkeleton(PlaylistPageListComponent, PlaylistPageListSkeleton);

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
