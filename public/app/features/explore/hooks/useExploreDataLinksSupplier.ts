import { useMemo } from 'react';

import { SplitOpen, TimeRange } from '@grafana/data';

import { exploreInternalLinkSupplierFactory } from '../utils/links';

export const useExploreInternalDataLinkSupplier = (splitOpenFn: SplitOpen, timeRange: TimeRange) => {
  return useMemo(() => {
    return exploreInternalLinkSupplierFactory(splitOpenFn, timeRange);
  }, [splitOpenFn, timeRange]);
};
