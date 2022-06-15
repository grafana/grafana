import { FC } from 'react';

import { GrafanaRouteComponentProps } from '../../core/navigation/types';

import { playlistSrv } from './PlaylistSrv';

interface Props extends GrafanaRouteComponentProps<{ uid: string }> {}

export const PlaylistStartPage: FC<Props> = ({ match }) => {
  playlistSrv.start(match.params.uid);
  return null;
};

export default PlaylistStartPage;
