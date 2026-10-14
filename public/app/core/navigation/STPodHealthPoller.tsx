import { useEffect, useRef, useState } from 'react';

import { useGetHealthQuery } from 'app/api/clients/legacy';

import {
  getStPodStatus,
  invalidateStPodReadiness,
  markStPodGaveUp,
  markStPodReady,
  markStPodWaiting,
  ST_POD_GIVE_UP_MS,
  ST_POD_POLL_INTERVAL_MS,
  StPodStatus,
} from './stPodReadiness';

export const STPodHealthPoller = ({ skip }: { skip: boolean }) => {
  const didResetStaleGaveUp = useRef(false);
  if (!skip && !didResetStaleGaveUp.current) {
    didResetStaleGaveUp.current = true;
    if (getStPodStatus() === StPodStatus.GaveUp) {
      invalidateStPodReadiness();
    }
  }

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
      if (getStPodStatus() !== StPodStatus.Ready) {
        markStPodGaveUp();
      }
      setFinished(true);
    }, ST_POD_GIVE_UP_MS);

    return () => clearTimeout(timer);
  }, [skip, finished]);

  return null;
};
