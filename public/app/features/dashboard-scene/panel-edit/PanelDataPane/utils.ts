import { useEffect, useMemo, useState } from 'react';

import { isExpressionReference } from '@grafana/runtime';
import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { type DataQuery } from '@grafana/schema';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';

async function isBackendDatasource(uid: string): Promise<boolean> {
  if (uid === SHARED_DASHBOARD_QUERY) {
    return false;
  }
  const settings = await getDataSourceInstanceSettings(uid);
  return settings?.meta.backend === true;
}

/**
 * Checks if there's at least one backend datasource available in the panel
 * Backend datasources have meta.backend === true
 */
export async function hasBackendDatasource({
  datasourceUid,
  queries,
}: {
  datasourceUid: string | undefined;
  queries?: DataQuery[];
}): Promise<boolean> {
  if (datasourceUid === SHARED_DASHBOARD_QUERY) {
    return false;
  }

  // A panel level datasource only answers this on its own when every query runs through it. V2
  // panels don't carry one unless the queries are mixed, and callers that infer it from the first
  // query can land on an expression ref, so both of those fall through to the queries below.
  if (datasourceUid && !isExpressionReference(datasourceUid)) {
    const mainDsSettings = await getDataSourceInstanceSettings(datasourceUid);
    if (mainDsSettings && !mainDsSettings.meta.mixed) {
      return mainDsSettings.meta.backend === true;
    }
  }

  // Expression queries resolve to settings without meta.backend, so they never count as backend.
  if (!queries?.length) {
    return false;
  }

  const results = await Promise.all(
    queries.map((query) => (query.datasource?.uid ? isBackendDatasource(query.datasource.uid) : Promise.resolve(false)))
  );
  return results.some(Boolean);
}

/**
 * `undefined` means the lookup has not resolved for the current datasource/queries yet.
 * Callers must not treat that as frontend-only — the previous result is also discarded
 * as soon as the inputs change, so a stale `true` cannot linger mid-switch.
 */
export function useHasBackendDatasource({
  datasourceUid,
  queries,
}: {
  datasourceUid: string | undefined;
  queries?: DataQuery[];
}): boolean | undefined {
  const queryKey = useMemo(() => JSON.stringify(queries?.map((query) => query.datasource?.uid) ?? []), [queries]);
  const lookupKey = `${datasourceUid ?? ''}:${queryKey}`;
  const [resolved, setResolved] = useState<{ key: string; value: boolean }>();

  useEffect(() => {
    let cancelled = false;

    hasBackendDatasource({ datasourceUid, queries }).then((value) => {
      if (!cancelled) {
        setResolved({ key: lookupKey, value });
      }
    });

    return () => {
      cancelled = true;
    };
    // queryKey covers query datasource identity; queries is read inside the callback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasourceUid, queryKey, lookupKey]);

  return resolved?.key === lookupKey ? resolved.value : undefined;
}
