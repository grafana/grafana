import { useParams } from 'react-router-dom-v5-compat';

import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { playlistSrv } from './PlaylistSrv';

interface Props extends GrafanaRouteComponentProps<{ uid: string }> {}

// This is a react page that just redirects to new URLs
export default function PlaylistStartPage({ match }: Props) {
  const { uid = '' } = useParams();
  playlistSrv.start(uid);
  return null;
}
