import { defaultIntervals } from '@grafana/ui';

interface Args {
  params: Record<string, string>;
  currentRefresh: string | boolean | undefined;
  isAllowedIntervalFn: (interval: string) => boolean;
  minRefreshInterval: string;
  refreshIntervals?: string[];
}

export function getRefreshFromUrl({
  params,
  currentRefresh,
  isAllowedIntervalFn,
  minRefreshInterval,
  refreshIntervals = defaultIntervals,
}: Args): string | boolean | undefined {
  if (!params.refresh) {
    return currentRefresh;
  }

  const isAllowedInterval = isAllowedIntervalFn(params.refresh);
  const isExistingInterval = refreshIntervals.find((interval) => interval === params.refresh);

  if (!isAllowedInterval || !isExistingInterval) {
    const minRefreshIntervalInIntervals = minRefreshInterval
      ? refreshIntervals.find((interval) => interval === minRefreshInterval)
      : undefined;
    const lowestRefreshInterval = refreshIntervals?.length ? refreshIntervals[0] : undefined;

    return minRefreshIntervalInIntervals ?? lowestRefreshInterval ?? currentRefresh;
  }

  return params.refresh || currentRefresh;
}
