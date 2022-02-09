import { FC } from 'react';
import { GrafanaRouteComponentProps } from '../../core/navigation/types';
import { playlistSrv } from './PlaylistSrv';

interface Props extends GrafanaRouteComponentProps<{ id: string }> {}

export const PlaylistStartPage: FC<Props> = ({ match }) => {
  playlistSrv.start(parseInt(match.params.id, 10));
  return null;
};

export default PlaylistStartPage;
