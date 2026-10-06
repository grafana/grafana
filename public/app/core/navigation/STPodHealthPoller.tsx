import { useEffect, useState } from 'react';

import { useGetHealthQuery } from 'app/api/clients/legacy';

import { markStPodGaveUp, markStPodReady, markStPodWaiting } from './stPodReadiness';

export const STPodHealthPoller = ({ skip }: { skip: boolean }) => {
  const [finished, setFinished] = useState(false);
  const { data, isLoading } = useGetHealthQuery(undefined, {
    skip: skip || finished,
    pollingInterval: 10_000,
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
    }, 5 * 60_000);

    return () => clearTimeout(timer);
  }, [skip, finished]);

  return null;
};
