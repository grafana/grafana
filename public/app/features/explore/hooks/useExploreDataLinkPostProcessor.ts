import { useMemo } from 'react';

import { type SplitOpen, type TimeRange } from '@grafana/data';

import { exploreDataLinkPostProcessorFactory } from '../utils/links';

export const useExploreDataLinkPostProcessor = (splitOpenFn: SplitOpen, timeRange: TimeRange) => {
  return useMemo(() => {
    return exploreDataLinkPostProcessorFactory(splitOpenFn, timeRange);
  }, [splitOpenFn, timeRange]);
};
