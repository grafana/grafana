import React from 'react';
import { PlaylistDTO } from './types';
import { Button, Card, LinkButton } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

interface Props {
  setStartPlaylist: (playlistItem: PlaylistDTO) => void;
  setPlaylistToDelete: (playlistItem: PlaylistDTO) => void;
  playlists: PlaylistDTO[] | undefined;
}

export const PlaylistPageList = ({ playlists, setStartPlaylist, setPlaylistToDelete }: Props) => {
  return (
    <>
      {playlists!.map((playlist: PlaylistDTO) => (
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
};
