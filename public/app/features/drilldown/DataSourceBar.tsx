import { useEffect, useState } from 'react';

import { t } from '@grafana/i18n';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { SIGNALS, type Signal, dataSourceParam, suggestDataSources } from './dataSources';

// On first load, writes the related data sources for every signal the URL leaves open into the URL, so the URL
// always names the data sources in use. Returns true once that is done, so a view loads once with its final choice.
export function useFilledDataSources(): boolean {
  const [, updateQueryParams] = useQueryParams();
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fill = async () => {
      const suggestion = await suggestDataSources().catch((): Awaited<ReturnType<typeof suggestDataSources>> => ({}));
      const values: Record<string, string> = {};
      for (const signal of SIGNALS) {
        const uid = suggestion[signal];
        if (uid) {
          values[dataSourceParam(signal)] = uid;
        }
      }
      if (!cancelled) {
        if (Object.keys(values).length > 0) {
          updateQueryParams(values, true);
        }
        setFilled(true);
      }
    };
    fill();
    return () => {
      cancelled = true;
    };
  }, [updateQueryParams]);

  return filled;
}

// The key changes with any chosen data source, so a view remounts and reloads when one changes.
export function dataSourcesKey(queryParams: Record<string, unknown>): string {
  return SIGNALS.map((signal) => String(queryParams[dataSourceParam(signal)] ?? '')).join('|');
}

export function signalLabels(): Record<Signal, string> {
  return {
    metrics: t('drilldown-datasources.metrics', 'Metrics'),
    logs: t('drilldown-datasources.logs', 'Logs'),
    traces: t('drilldown-datasources.traces', 'Traces'),
    profiles: t('drilldown-datasources.profiles', 'Profiles'),
    knowledgegraph: t('drilldown-datasources.knowledgegraph', 'Knowledge graph'),
    sql: t('drilldown-datasources.sql', 'SQL'),
  };
}
