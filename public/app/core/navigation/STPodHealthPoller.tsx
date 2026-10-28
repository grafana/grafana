import { useEffect, useRef, useState } from 'react';

import { useGetHealthQuery } from 'app/api/clients/legacy';

import {
  getStPodStatus,
  invalidateStPodReadiness,
  markStPodReady,
  markStPodTimeout,
  markStPodWaiting,
  ST_POD_POLL_INTERVAL_MS,
  ST_POD_TIMEOUT_MS,
  StPodStatus,
} from './stPodReadiness';

export const STPodHealthPoller = ({ skip }: { skip: boolean }) => {
  const didResetStaleTimeout = useRef(false);
  if (!skip && !didResetStaleTimeout.current) {
    didResetStaleTimeout.current = true;
    if (getStPodStatus() === StPodStatus.Timeout) {
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
        markStPodTimeout();
      }
      setFinished(true);
    }, ST_POD_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [skip, finished]);

  return null;
};
