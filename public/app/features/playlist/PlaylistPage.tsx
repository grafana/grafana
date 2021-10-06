import React, { FC, useState } from 'react';
import { connect, MapStateToProps } from 'react-redux';
import { NavModel } from '@grafana/data';
import Page from 'app/core/components/Page/Page';
import { StoreState } from 'app/types';
import { GrafanaRouteComponentProps } from '../../core/navigation/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { useAsync } from 'react-use';
import { PlaylistDTO } from './types';
import { Button, Card, ConfirmModal, LinkButton } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import PageActionBar from 'app/core/components/PageActionBar/PageActionBar';
import EmptyListCTA from '../../core/components/EmptyListCTA/EmptyListCTA';
import { deletePlaylist, getAllPlaylist } from './api';
import { StartModal } from './StartModal';

interface ConnectedProps {
  navModel: NavModel;
}

export interface PlaylistPageProps extends ConnectedProps, GrafanaRouteComponentProps {}

export const PlaylistPage: FC<PlaylistPageProps> = ({ navModel }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [startPlaylist, setStartPlaylist] = useState<PlaylistDTO | undefined>();
  const [playlistToDelete, setPlaylistToDelete] = useState<PlaylistDTO | undefined>();
  const [forcePlaylistsFetch, setForcePlaylistsFetch] = useState(0);

  const { value: playlists, loading } = useAsync(async () => {
    return getAllPlaylist(searchQuery) as Promise<PlaylistDTO[]>;
  }, [forcePlaylistsFetch]);
  const hasPlaylists = playlists && playlists.length > 0;
  const onDismissDelete = () => setPlaylistToDelete(undefined);
  const onDeletePlaylist = () => {
    if (!playlistToDelete) {
      return;
    }
    deletePlaylist(playlistToDelete.id).finally(() => {
      setForcePlaylistsFetch(forcePlaylistsFetch + 1);
      setPlaylistToDelete(undefined);
    });
  };

  let content = (
    <EmptyListCTA
      title="There are no playlists created yet"
      buttonIcon="plus"
      buttonLink="playlists/new"
      buttonTitle="Create Playlist"
      proTip="You can use playlists to cycle dashboards on TVs without user control"
      proTipLink="http://docs.grafana.org/reference/playlist/"
      proTipLinkTitle="Learn more"
      proTipTarget="_blank"
    />
  );

  if (hasPlaylists) {
    content = (
      <>
        {playlists!.map((playlist) => (
          <Card heading={playlist.name} key={playlist.id.toString()}>
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
        ))}
      </>
    );
  }
  return (
    <Page navModel={navModel}>
      <Page.Contents isLoading={loading}>
        {hasPlaylists && (
          <PageActionBar
            searchQuery={searchQuery}
            linkButton={{ title: 'New playlist', href: '/playlists/new' }}
            setSearchQuery={setSearchQuery}
          />
        )}
        {content}
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

const mapStateToProps: MapStateToProps<ConnectedProps, {}, StoreState> = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'playlists'),
});

export default connect(mapStateToProps)(PlaylistPage);
