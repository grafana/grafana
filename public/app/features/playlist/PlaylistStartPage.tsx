import { useParams } from 'react-router-dom-v5-compat';

import { useGetPlaylistQuery } from '../../api/clients/playlist/v0alpha1';

import { playlistSrv } from './PlaylistSrv';

// This is a react page that just redirects to new URLs
export default function PlaylistStartPage() {
  const { uid = '' } = useParams();
  const { data, isLoading } = useGetPlaylistQuery({ name: uid });
  if (!isLoading && data) {
    playlistSrv.start(data);
  }
  return null;
}
