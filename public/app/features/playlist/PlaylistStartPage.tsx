import { useNavigationType, useParams } from 'react-router-dom-v5-compat';

import { locationService } from '@grafana/runtime';

import { playlistSrv } from './PlaylistSrv';

// This is a react page that just redirects to new URLs
export default function PlaylistStartPage() {
  const { uid = '' } = useParams();
  const navigationType = useNavigationType();
  if (navigationType === 'POP') {
    locationService.getHistory().goBack();
  } else {
    playlistSrv.start(uid);
  }
  return null;
}
