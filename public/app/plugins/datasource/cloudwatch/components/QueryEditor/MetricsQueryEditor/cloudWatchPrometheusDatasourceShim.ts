import { useEffect, useMemo } from 'react';

import { type ScopedVars, type TimeRange } from '@grafana/data';
import {
  applyModifyQuery,
  getPrometheusTime,
  getQueryHints,
  PrometheusCacheLevel,
  type PrometheusDatasource,
  type PromQuery,
} from '@grafana/prometheus';

import { type CloudWatchDatasource } from '../../../datasource';

import { CloudWatchPromQLLanguageProvider } from './CloudWatchPromQLLanguageProvider';

/**
 * Minimal stand-in for PrometheusDatasource covering the surface area touched
 * by @grafana/prometheus's query field, options panel, and visual query
 * builder. CloudWatch doesn't extend PrometheusDatasource; this shim lets us
 * reuse the upstream UI without a hard dependency.
 */
export function makeCloudWatchPrometheusDatasourceShim(datasource: CloudWatchDatasource): PrometheusDatasource {
  const shim: Partial<PrometheusDatasource> = {
    interpolateString: (value: string, scopedVars?: ScopedVars) => datasource.templateSrv.replace(value, scopedVars),
    getVariables: () => datasource.getVariables(),
    lookupsDisabled: false,
    cacheLevel: PrometheusCacheLevel.None,
    getAdjustedInterval: (timeRange: TimeRange) => ({
      start: getPrometheusTime(timeRange.from, false).toString(),
      end: getPrometheusTime(timeRange.to, true).toString(),
    }),
    getQueryHints: (query: PromQuery, series: unknown[]) => getQueryHints(query.expr ?? '', series),
    modifyQuery: applyModifyQuery,
  };
  // The upstream PromQL components type their datasource prop as the full
  // PrometheusDatasource class; this shim only implements the subset they call.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return shim as PrometheusDatasource;
}

/**
 * Builds the shim once per datasource and attaches a CloudWatchPromQLLanguageProvider.
 * Region and time-range changes flow through updateRegion / start() in a useeffect rather
 * than rebuilding the shim, so the language provider's label key/value caches survive.
 */
export function useCloudWatchPrometheusDatasource(
  datasource: CloudWatchDatasource,
  region: string,
  timeRange: TimeRange
): PrometheusDatasource {
  const { shim, languageProvider } = useMemo(() => {
    const built = makeCloudWatchPrometheusDatasourceShim(datasource);
    const provider = new CloudWatchPromQLLanguageProvider(built, datasource.resources, region);
    built.languageProvider = provider;
    return { shim: built, languageProvider: provider };

    // region intentionally omitted from deps; handled by updateRegion in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource]);

  useEffect(() => {
    languageProvider.updateRegion(region);
    languageProvider.start(timeRange);

    // timeRange is intentionally excluded: with a relative range (e.g. now-6h) it's a new object
    // on every render, which would restart the provider and fire a burst of resource requests on
    // each tick. start() only seeds the initial caches; autocomplete queries the current range on
    // demand via queryLabelKeys/queryLabelValues.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [languageProvider, region]);

  return shim;
}
