import { useEffect } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { useGetSlideshowQuery } from '@grafana/api-clients/rtkq/collections/v1alpha1';

import { playlistSrv } from '../playlist/PlaylistSrv';

// Starts playback and hands the screen over to the first item, so there is nothing to render.
export default function SlideshowPlayPage() {
  const { uid = '' } = useParams();
  const { data } = useGetSlideshowQuery({ name: uid });

  useEffect(() => {
    if (data) {
      playlistSrv.startSlideshow(data);
    }
  }, [data]);

  return null;
}
