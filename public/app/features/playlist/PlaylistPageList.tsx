import { css } from '@emotion/css';
import React from 'react';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Card, LinkButton, ModalsController, Stack, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
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
                    tooltip={t('playlist-page.card.tooltip', 'Share playlist')}
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
                <Trans i18nKey="playlist-page.card.start">Start playlist</Trans>
              </Button>
              {contextSrv.isEditor && (
                <>
                  <LinkButton key="edit" variant="secondary" href={`/playlists/edit/${playlist.uid}`} icon="cog">
                    <Trans i18nKey="playlist-page.card.edit">Edit playlist</Trans>
                  </LinkButton>
                  <Button
                    disabled={false}
                    onClick={() => setPlaylistToDelete(playlist)}
                    icon="trash-alt"
                    variant="destructive"
                  >
                    <Trans i18nKey="playlist-page.card.delete">Delete playlist</Trans>
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

const PlaylistPageListSkeleton = () => {
  const styles = useStyles2(getStyles);
  const skeletonStyles = useStyles2(getSkeletonStyles);
  return (
    <div className={styles.list}>
      {new Array(3).fill(null).map((_item, index) => (
        <Card className={skeletonStyles.card} key={index}>
          <Card.Heading>
            <Skeleton width={140} />
          </Card.Heading>
          <Card.Actions>
            <Stack direction="row">
              <Skeleton containerClassName={skeletonStyles.button} width={142} height={32} />
              {contextSrv.isEditor && (
                <>
                  <Skeleton containerClassName={skeletonStyles.button} width={135} height={32} />
                  <Skeleton containerClassName={skeletonStyles.button} width={153} height={32} />
                </>
              )}
            </Stack>
          </Card.Actions>
        </Card>
      ))}
    </div>
  );
};

PlaylistPageList.Skeleton = PlaylistPageListSkeleton;

function getSkeletonStyles(theme: GrafanaTheme2) {
  return {
    button: css({
      lineHeight: 1,
    }),
    card: css({
      backgroundColor: theme.colors.background.primary,
      outline: `1px solid ${theme.colors.background.secondary}`,
      outlineOffset: '-1px',
    }),
  };
}

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
