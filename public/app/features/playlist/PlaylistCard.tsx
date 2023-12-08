import { css } from '@emotion/css';
import React from 'react';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Card, LinkButton, ModalsController, Stack, useSkeleton, useStyles2, withSkeleton } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';
import { DashNavButton } from 'app/features/dashboard/components/DashNav/DashNavButton';

import { ShareModal } from './ShareModal';
import { Playlist } from './types';

interface Props {
  setStartPlaylist: (playlistItem: Playlist) => void;
  setPlaylistToDelete: (playlistItem: Playlist) => void;
  playlist: Playlist;
}

const PlaylistCardComponent = ({ playlist, setStartPlaylist, setPlaylistToDelete }: Props) => {
  return (
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
  );
};

const PlaylistCardSkeleton = () => {
  const { skeletonProps } = useSkeleton();
  const skeletonStyles = useStyles2(getSkeletonStyles);
  return (
    <Card {...skeletonProps}>
      <Card.Heading>
        <Skeleton width={140} />
      </Card.Heading>
      <Card.Actions>
        <Stack direction="row" wrap="wrap">
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
  );
};

export const PlaylistCard = withSkeleton(PlaylistCardComponent, PlaylistCardSkeleton);

function getSkeletonStyles(theme: GrafanaTheme2) {
  return {
    button: css({
      lineHeight: 1,
    }),
  };
}
