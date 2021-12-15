import React from 'react';
import { PlaylistDTO } from './types';
import { Button, Card, LinkButton, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';

interface Props {
  setStartPlaylist: (playlistItem: PlaylistDTO) => void;
  setPlaylistToDelete: (playlistItem: PlaylistDTO) => void;
  playlists: PlaylistDTO[] | undefined;
}

export const PlaylistPageList = ({ playlists, setStartPlaylist, setPlaylistToDelete }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <ul className={styles.list}>
      {playlists!.map((playlist: PlaylistDTO) => (
        <li className={styles.listItem} key={playlist.id.toString()}>
          <Card>
            <Card.Heading>{playlist.name}</Card.Heading>
            <Card.Actions>
              <Button variant="secondary" icon="play" onClick={() => setStartPlaylist(playlist)}>
                Start playlist
              </Button>
              {contextSrv.isEditor && (
                <>
                  <LinkButton key="edit" variant="secondary" href={`/playlists/edit/${playlist.id}`} icon="cog">
                    Edit playlist
                  </LinkButton>
                  <Button
                    disabled={false}
                    onClick={() => setPlaylistToDelete({ id: playlist.id, name: playlist.name })}
                    icon="trash-alt"
                    variant="destructive"
                  >
                    Delete playlist
                  </Button>
                </>
              )}
            </Card.Actions>
          </Card>
        </li>
      ))}
    </ul>
  );
};

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
