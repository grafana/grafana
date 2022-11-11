import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { playlistSrv } from './PlaylistSrv';

interface Props extends GrafanaRouteComponentProps<{ uid: string }> {}

// This is a react page that just redirects to new URLs
export default function PlaylistStartPage({ match }: Props) {
  playlistSrv.start(match.params.uid);
  return null;
}
