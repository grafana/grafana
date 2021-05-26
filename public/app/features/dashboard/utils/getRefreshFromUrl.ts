import { defaultIntervals } from '@grafana/ui';

interface Args {
  params: Record<string, string>;
  currentRefresh: string | boolean | undefined;
  isAllowedIntervalFn: (interval: string) => boolean;
  minRefreshInterval: string;
  refreshIntervals?: string[];
}

// getRefreshFromUrl function returns the value from the supplied &refresh= param in url.
// If the supplied interval is not allowed or does not exist in the refresh intervals for the dashboard then we
// try to find the first refresh interval that matches the minRefreshInterval (min_refresh_interval in ini)
// or just take the first interval.
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
