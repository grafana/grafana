import { useEffect, useMemo, useState } from 'react';

import { type DataSourceInstanceSettings, type DataSourceJsonData } from '@grafana/data';
import { getTraceToLogsDestinations, type TraceToLogsData, type TraceToLogsOptionsV2 } from '@grafana/o11y-ds-frontend';
import { getDataSourceInstanceSettings, logError } from '@grafana/runtime';

import { type TraceToLogsDestination } from './components/types/links';

export type ResolvedSettings = Array<
  { datasourceUid: string; settings: DataSourceInstanceSettings<DataSourceJsonData> | undefined } | undefined
>;

/**
 * Keeps a resolved result only for a slot that pointed at the same data source before and after a configuration change.
 * A lookup that settles just after its slot was removed can still write its result, and that result must not come back
 * when the slot is added again.
 */
export function keepUnchangedSlots(
  previous: ResolvedSettings,
  before: TraceToLogsOptionsV2[],
  after: TraceToLogsOptionsV2[]
): ResolvedSettings {
  return after.map(({ datasourceUid }, index) =>
    before[index]?.datasourceUid === datasourceUid && previous[index]?.datasourceUid === datasourceUid
      ? previous[index]
      : undefined
  );
}

/**
 * Resolves the logs data source of every configured trace to logs destination. Destinations without a data source,
 * or whose data source no longer exists, are left out.
 */
export function useTraceToLogsDestinations(jsonData: TraceToLogsData | undefined): TraceToLogsDestination[] {
  const configured = useMemo(() => getTraceToLogsDestinations(jsonData), [jsonData]);
  const uidsKey = JSON.stringify(configured.map((options) => options.datasourceUid ?? null));
  const [resolvedSettings, setResolvedSettings] = useState<ResolvedSettings>([]);

  // When the configured data sources change, results for slots that are gone or now point elsewhere are dropped, so a
  // destination added back later waits for its own lookup instead of reusing settings that may be stale.
  const [resolvedFor, setResolvedFor] = useState({ uidsKey, configured });
  if (resolvedFor.uidsKey !== uidsKey) {
    setResolvedFor({ uidsKey, configured });
    setResolvedSettings((previous) => keepUnchangedSlots(previous, resolvedFor.configured, configured));
  }

  useEffect(() => {
    if (configured.length === 0) {
      return;
    }

    let cancelled = false;
    // Each lookup is published as soon as it settles, so a slow data source does not hold back the other links.
    configured.forEach((options, index) => {
      const datasourceUid = options.datasourceUid;
      // An undefined uid would resolve to the default data source.
      if (!datasourceUid) {
        return;
      }
      getDataSourceInstanceSettings(datasourceUid)
        .catch((error) => {
          // A data source that no longer exists resolves to undefined, so this is a failed load. Only this
          // destination is dropped, so one broken logs link does not hide the others.
          logError(error instanceof Error ? error : new Error(String(error)), { datasourceUid });
          return undefined;
        })
        .then((settings) => {
          if (!cancelled) {
            setResolvedSettings((previous) => {
              const next = [...previous];
              next[index] = { datasourceUid, settings };
              return next;
            });
          }
        });
    });

    return () => {
      cancelled = true;
    };
    // `configured` is fully described by uidsKey for resolution purposes; options are matched up below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uidsKey]);

  return useMemo(() => {
    // Counted before resolution, so a deleted data source does not switch the others back to single-destination behavior.
    const isOneOfMany = configured.filter((options) => options.datasourceUid).length > 1;
    return configured.flatMap((options, index) => {
      const resolved = resolvedSettings[index];
      // Settings resolved for a previous configuration can still be in place while new ones resolve. Match on the
      // requested reference, not settings.uid: a data source name also resolves, to a different uid.
      if (!resolved?.settings || resolved.datasourceUid !== options.datasourceUid) {
        return [];
      }
      return [{ index, options, settings: resolved.settings, isOneOfMany }];
    });
  }, [configured, resolvedSettings]);
}
