import { css } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, Card, LinkButton, ModalsController, Stack, useStyles2 } from '@grafana/ui';
import { attachSkeleton, type SkeletonComponent } from '@grafana/ui/unstable';
import { ManagedBadge } from 'app/features/provisioning/components/ManagedBadge';
import {
  getManagerIdentity,
  getManagerKind,
  getSourcePath,
  isManaged,
} from 'app/features/provisioning/utils/managedResource';

import { type Playlist } from '../../api/clients/playlist/v1';

import { ShareModal } from './ShareModal';
import { useCanWritePlaylists } from './utils';

interface Props {
  setStartPlaylist: (playlistItem: Playlist) => void;
  setPlaylistToDelete: (playlistItem: Playlist) => void;
  playlist: Playlist;
}

const PlaylistCardComponent = ({ playlist, setStartPlaylist, setPlaylistToDelete }: Props) => {
  const canWrite = useCanWritePlaylists();
  return (
    <Card noMargin>
      <Card.Heading>
        <Stack direction="row" gap={1} alignItems="center" wrap>
          {playlist.spec?.title}
          {isManaged(playlist) && (
            <ManagedBadge
              managerKind={getManagerKind(playlist)}
              name={getManagerIdentity(playlist)}
              repositoryName={getManagerIdentity(playlist)}
              sourcePath={getSourcePath(playlist)}
            />
          )}
        </Stack>
      </Card.Heading>
      <Card.Actions>
        <Button
          variant="accent"
          icon="play"
          onClick={() => setStartPlaylist(playlist)}
          fill="outline"
          size="sm"
          aria-label={t('playlist-page.card.start-label', 'Start playlist {{ name }} ', { name: playlist.spec?.title })}
        >
          <Trans i18nKey="playlist-page.card.start">Start</Trans>
        </Button>
        <ModalsController key="button-share">
          {({ showModal, hideModal }) => (
            <Button
              tooltip={t('playlist-page.card.tooltip', 'Share')}
              icon="share-alt"
              variant="secondary"
              size="sm"
              aria-label={t('playlist-page.card.share-label', 'Share playlist {{ name }} ', {
                name: playlist.spec?.title,
              })}
              onClick={() => {
                showModal(ShareModal, {
                  playlistUid: playlist.metadata?.name ?? '',
                  onDismiss: hideModal,
                });
              }}
            >
              <Trans i18nKey="playlist-page.card.share">Share</Trans>
            </Button>
          )}
        </ModalsController>
        {canWrite && (
          <LinkButton
            key="edit"
            variant="secondary"
            href={`/playlists/edit/${playlist.metadata?.name}`}
            icon="cog"
            size="sm"
            aria-label={t('playlist-page.card.edit-label', 'Edit playlist {{ name }} ', { name: playlist.spec?.title })}
          >
            <Trans i18nKey="playlist-page.card.edit">Edit</Trans>
          </LinkButton>
        )}
        {canWrite && (
          <Button
            disabled={false}
            onClick={() => setPlaylistToDelete(playlist)}
            icon="trash-alt"
            variant="secondary"
            size="sm"
            aria-label={t('playlist-page.card.delete-label', 'Delete playlist {{ name }} ', {
              name: playlist.spec?.title,
            })}
          >
            <Trans i18nKey="playlist-page.card.delete">Delete</Trans>
          </Button>
        )}
      </Card.Actions>
    </Card>
  );
};

const PlaylistCardSkeleton: SkeletonComponent = ({ rootProps }) => {
  const skeletonStyles = useStyles2(getSkeletonStyles);
  const canWrite = useCanWritePlaylists();
  return (
    <Card noMargin {...rootProps}>
      <Card.Heading>
        <Skeleton width={140} />
      </Card.Heading>
      <Card.Actions>
        <Stack direction="row" wrap="wrap">
          <Skeleton containerClassName={skeletonStyles.button} width={142} height={32} />
          {canWrite && (
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
