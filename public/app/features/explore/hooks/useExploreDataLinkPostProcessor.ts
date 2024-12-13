import { useMemo } from 'react';

import { SplitOpen, TimeRange } from '@grafana/data';
import { exploreDataLinkPostProcessorFactory } from '@grafana/runtime';

export const useExploreDataLinkPostProcessor = (splitOpenFn: SplitOpen, timeRange: TimeRange) => {
  return useMemo(() => {
    return exploreDataLinkPostProcessorFactory(splitOpenFn, timeRange);
  }, [splitOpenFn, timeRange]);
};
