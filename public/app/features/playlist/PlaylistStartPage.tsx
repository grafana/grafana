import { FC } from 'react';
import { playlistSrv } from './PlaylistSrv';
import { GrafanaRouteComponentProps } from '@grafana/data';

interface Props extends GrafanaRouteComponentProps<{ id: string }> {}

export const PlaylistStartPage: FC<Props> = ({ match }) => {
  playlistSrv.start(parseInt(match.params.id, 10));
  return null;
};

export default PlaylistStartPage;
