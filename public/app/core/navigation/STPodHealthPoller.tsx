import { useEffect, useState } from 'react';

import { useGetHealthQuery } from 'app/api/clients/legacy';

import {
  markStPodGaveUp,
  markStPodReady,
  markStPodWaiting,
  ST_POD_GIVE_UP_MS,
  ST_POD_POLL_INTERVAL_MS,
} from './stPodReadiness';

export const STPodHealthPoller = ({ skip }: { skip: boolean }) => {
  const [finished, setFinished] = useState(false);
  const { data, isLoading } = useGetHealthQuery(undefined, {
    skip: skip || finished,
    pollingInterval: ST_POD_POLL_INTERVAL_MS,
  });
  useEffect(() => {
    if (skip || finished || isLoading) {
      return;
    }
    if (data?.database === 'ok') {
      markStPodReady();
      setFinished(true);
    } else {
      markStPodWaiting();
    }
  }, [skip, finished, isLoading, data]);

  useEffect(() => {
    if (skip || finished) {
      return;
    }
    const timer = setTimeout(() => {
      markStPodGaveUp();
      setFinished(true);
    }, ST_POD_GIVE_UP_MS);

    return () => clearTimeout(timer);
  }, [skip, finished]);

  return null;
};
