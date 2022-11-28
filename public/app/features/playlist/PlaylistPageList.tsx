import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Card, LinkButton, ModalsController, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { DashNavButton } from 'app/features/dashboard/components/DashNav/DashNavButton';

import { ShareModal } from './ShareModal';
import { Playlist } from './types';

interface Props {
  setStartPlaylist: (playlistItem: Playlist) => void;
  setPlaylistToDelete: (playlistItem: Playlist) => void;
  playlists: Playlist[] | undefined;
}

export const PlaylistPageList = ({ playlists, setStartPlaylist, setPlaylistToDelete }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <ul className={styles.list}>
      {playlists!.map((playlist: Playlist) => (
        <li className={styles.listItem} key={playlist.uid}>
          <Card>
            <Card.Heading>
              {playlist.name}
              <ModalsController key="button-share">
                {({ showModal, hideModal }) => (
                  <DashNavButton
                    tooltip="Share playlist"
                    icon="share-alt"
                    iconSize="lg"
                    onClick={() => {
                      showModal(ShareModal, {
                        playlistUid: playlist.uid,
                        onDismiss: hideModal,
                      });
                    }}
                  />
                )}
              </ModalsController>
            </Card.Heading>
            <Card.Actions>
              <Button variant="secondary" icon="play" onClick={() => setStartPlaylist(playlist)}>
                Start playlist
              </Button>
              {contextSrv.isEditor && (
                <>
                  <LinkButton key="edit" variant="secondary" href={`/playlists/edit/${playlist.uid}`} icon="cog">
                    Edit playlist
                  </LinkButton>
                  <Button
                    disabled={false}
                    onClick={() => setPlaylistToDelete(playlist)}
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
