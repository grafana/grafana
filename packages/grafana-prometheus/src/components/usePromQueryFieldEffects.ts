import { useEffect, useRef } from 'react';

import { DateTime } from '@grafana/data';

import { roundMsToMin } from '../language_utils';

import { CancelablePromise } from './cancelable-promise';

export function usePromQueryFieldEffects(
  languageProvider: any,
  range: any,
  data: any,
  refreshMetrics: (languageProviderInitRef: React.MutableRefObject<CancelablePromise<any> | null>) => Promise<void>,
  refreshHint: () => void
) {
  const lastRangeRef = useRef<{ from: DateTime; to: DateTime } | null>(null);
  const languageProviderInitRef = useRef<CancelablePromise<any> | null>(null);

  // Effect for initial load
  useEffect(() => {
    if (languageProvider) {
      refreshMetrics(languageProviderInitRef);
    }
    refreshHint();

    return () => {
      if (languageProviderInitRef.current) {
        languageProviderInitRef.current.cancel();
        languageProviderInitRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect for time range changes
  useEffect(() => {
    if (!range) {
      return;
    }

    const currentFrom = roundMsToMin(range.from.valueOf());
    const currentTo = roundMsToMin(range.to.valueOf());

    if (!lastRangeRef.current) {
      lastRangeRef.current = { from: range.from, to: range.to };
      refreshMetrics(languageProviderInitRef);
      return;
    }

    const lastFrom = roundMsToMin(lastRangeRef.current.from.valueOf());
    const lastTo = roundMsToMin(lastRangeRef.current.to.valueOf());

    if (currentFrom !== lastFrom || currentTo !== lastTo) {
      lastRangeRef.current = { from: range.from, to: range.to };
      refreshMetrics(languageProviderInitRef);
    }
  }, [range, refreshMetrics]);

  // Effect for data changes (refreshing hints)
  useEffect(() => {
    refreshHint();
  }, [data?.series, refreshHint]);

  return languageProviderInitRef;
}
