import { useEffect, useState } from 'react';

import { config, getDataSourceInstanceSettings } from '@grafana/runtime';
import { type DataSourceRef } from '@grafana/schema';

/**
 * Names of the data sources behind the given refs, in first-use order, without mixed and
 * dashboard pseudo data sources. Empty on public dashboards, which do not expose data sources.
 */
export function useDataSourceNames(refs: Array<DataSourceRef | null | undefined>): string[] {
  const [names, setNames] = useState<string[]>([]);
  // Refs are rebuilt on every render; their content is what decides whether to resolve again.
  const key = JSON.stringify(refs.filter(Boolean).map((ref) => ref?.uid ?? ''));

  useEffect(() => {
    const uids: string[] = JSON.parse(key);
    if (config.publicDashboardAccessToken || uids.length === 0) {
      return;
    }
    let cancelled = false;
    Promise.all([...new Set(uids)].map((uid) => getDataSourceInstanceSettings({ uid })))
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const resolved = settings.filter((s) => s && !s.meta.mixed && s.meta.id !== 'dashboard').map((s) => s!.name);
        setNames([...new Set(resolved)]);
      })
      .catch(() => {
        // A missing data source only leaves its name out of the line.
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return names;
}
