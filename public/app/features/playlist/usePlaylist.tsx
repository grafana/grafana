import { useEffect, useState } from 'react';

import { getPlaylist } from './api';
import { Playlist } from './types';

export function usePlaylist(playlistUid?: string) {
  const [playlist, setPlaylist] = useState<Playlist>({ items: [], interval: '5m', name: '', uid: '' });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const initPlaylist = async () => {
      if (!playlistUid) {
        setLoading(false);
        return;
      }
      const list = await getPlaylist(playlistUid);
      setPlaylist(list);
      setLoading(false);
    };
    initPlaylist();
  }, [playlistUid]);

  return { playlist, loading };
}
