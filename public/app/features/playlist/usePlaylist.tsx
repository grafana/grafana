import { useEffect, useState } from 'react';

import { getPlaylist } from './api';
import { Playlist } from './types';

export function usePlaylist(playlistId?: number) {
  const [playlist, setPlaylist] = useState<Playlist>({ items: [], interval: '5m', name: '' });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const initPlaylist = async () => {
      if (!playlistId) {
        setLoading(false);
        return;
      }
      const list = await getPlaylist(playlistId);
      setPlaylist(list);
      setLoading(false);
    };
    initPlaylist();
  }, [playlistId]);

  return { playlist, loading };
}
