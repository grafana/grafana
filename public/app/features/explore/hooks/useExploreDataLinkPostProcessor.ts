import { useMemo } from 'react';

import type { SplitOpen, TimeRange } from '@grafana/data/types';

import { exploreDataLinkPostProcessorFactory } from '../utils/links';

export const useExploreDataLinkPostProcessor = (splitOpenFn: SplitOpen, timeRange: TimeRange) => {
  return useMemo(() => {
    return exploreDataLinkPostProcessorFactory(splitOpenFn, timeRange);
  }, [splitOpenFn, timeRange]);
};
