import { MutableRefObject, useEffect, useRef } from 'react';

import { DataFrame, DateTime, TimeRange } from '@grafana/data';

import PromQlLanguageProvider from '../language_provider';
import { roundMsToMin } from '../language_utils';

import { CancelablePromise } from './cancelable-promise';

export function usePromQueryFieldEffects(
  languageProvider: PromQlLanguageProvider,
  range: TimeRange | undefined,
  series: DataFrame[] | undefined,
  refreshMetrics: (languageProviderInitRef: MutableRefObject<CancelablePromise<unknown> | null>) => Promise<void>,
  refreshHint: () => void
) {
  const lastRangeRef = useRef<{ from: DateTime; to: DateTime } | null>(null);
  const languageProviderInitRef = useRef<CancelablePromise<unknown> | null>(null);

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
  }, [series, refreshHint]);

  return languageProviderInitRef;
}
