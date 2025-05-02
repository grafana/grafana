import { css } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Card, LinkButton, ModalsController, Stack, useStyles2 } from '@grafana/ui';
import { attachSkeleton, SkeletonComponent } from '@grafana/ui/unstable';
import { t, Trans } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';
import { DashNavButton } from 'app/features/dashboard/components/DashNav/DashNavButton';

import { Playlist } from '../../api/clients/playlist';

import { ShareModal } from './ShareModal';

interface Props {
  setStartPlaylist: (playlistItem: Playlist) => void;
  setPlaylistToDelete: (playlistItem: Playlist) => void;
  playlist: Playlist;
}

const PlaylistCardComponent = ({ playlist, setStartPlaylist, setPlaylistToDelete }: Props) => {
  return (
    <Card>
      <Card.Heading>
        {playlist.spec.title}
        <ModalsController key="button-share">
          {({ showModal, hideModal }) => (
            <DashNavButton
              tooltip={t('playlist-page.card.tooltip', 'Share playlist')}
              icon="share-alt"
              iconSize="lg"
              onClick={() => {
                showModal(ShareModal, {
                  playlistUid: playlist.metadata.name ?? '',
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
            <LinkButton key="edit" variant="secondary" href={`/playlists/edit/${playlist.metadata.name}`} icon="cog">
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

const PlaylistCardSkeleton: SkeletonComponent = ({ rootProps }) => {
  const skeletonStyles = useStyles2(getSkeletonStyles);
  return (
    <Card {...rootProps}>
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

export const PlaylistCard = attachSkeleton(PlaylistCardComponent, PlaylistCardSkeleton);

function getSkeletonStyles(theme: GrafanaTheme2) {
  return {
    button: css({
      lineHeight: 1,
    }),
  };
}
