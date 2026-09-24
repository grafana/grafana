import { useAsync } from 'react-use';

import { type DataSourceInstanceListItem, type DataSourceInstanceSettings } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';

import {
  SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES,
  isSupportedExternalPrometheusFlavoredRulesSourceType,
  isValidRecordingRulesTarget,
} from './predicates';

type EnrichedDataSource =
  | { item: DataSourceInstanceListItem; enrichment: 'ok'; settings: DataSourceInstanceSettings }
  | { item: DataSourceInstanceListItem; enrichment: 'unavailable' };

// Temporary: the list items carry no jsonData. Read it from config.datasources until Alerting has a
// dedicated backend API that returns the jsonData fields its data source checks need.
function enrich(items: DataSourceInstanceListItem[]): EnrichedDataSource[] {
  // eslint-disable-next-line @grafana/no-config-datasources
  const settingsByUid = new Map(Object.values(config.datasources).map((ds) => [ds.uid, ds]));

  return items.map((item) => {
    const settings = settingsByUid.get(item.uid);
    return settings ? { item, enrichment: 'ok', settings } : { item, enrichment: 'unavailable' };
  });
}

/**
 * The data sources that accept recording rules. The items carry no `jsonData`, so callers cannot
 * re-check the condition; test membership by `uid` instead.
 */
export async function getDataSourcesWithValidRecordingTarget(): Promise<DataSourceInstanceListItem[]> {
  const listed = await getDataSourceInstanceList({
    type: [...SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES],
    all: true,
  });

  // A type filter does not stop the list from appending the built-in `-- Grafana --` data source.
  const candidates = listed.filter((item) => isSupportedExternalPrometheusFlavoredRulesSourceType(item.type));

  // An absent allowAsRecordingRulesTarget means allowed, so a candidate without settings must be
  // dropped rather than judged on default settings.
  const enriched = enrich(candidates);

  return enriched.flatMap((ds) =>
    ds.enrichment === 'ok' && isValidRecordingRulesTarget(ds.settings) ? [ds.item] : []
  );
}

export interface DataSourcesWithValidRecordingTargetResult {
  items: DataSourceInstanceListItem[];
  isLoading: boolean;
  error?: Error;
}

const NO_ITEMS: DataSourceInstanceListItem[] = [];

export function useDataSourcesWithValidRecordingTarget(): DataSourcesWithValidRecordingTargetResult {
  const { loading, error, value } = useAsync(getDataSourcesWithValidRecordingTarget, []);

  return { items: value ?? NO_ITEMS, isLoading: loading, error };
}
