import React from 'react';

import { usePolling } from '../../hooks/usePolling';

interface Props {
  title: string;
  unit?: string;
  /** Async function that fetches the current metric value. */
  fetchMetric: () => Promise<number>;
  /** Polling interval in milliseconds. Defaults to 5000. */
  refreshInterval?: number;
}

/**
 * Displays a single numeric metric that refreshes automatically at a fixed interval.
 */
export function LiveMetricCard({ title, unit, fetchMetric, refreshInterval = 5000 }: Props) {
  const { data, loading, error } = usePolling(fetchMetric, refreshInterval);

  return (
    <div className="live-metric-card">
      <h4>{title}</h4>
      {loading && <span>Loading…</span>}
      {error && <span>Error: {error.message}</span>}
      {!loading && !error && (
        <span className="live-metric-card__value">
          {data !== null ? `${data}${unit ? ` ${unit}` : ''}` : '—'}
        </span>
      )}
    </div>
  );
}
