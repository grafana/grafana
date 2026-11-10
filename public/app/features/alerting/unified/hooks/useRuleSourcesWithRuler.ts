import { useEffect, useState } from 'react';

import { type RulesSourceDataSource } from '@grafana/alerting/internal';

import { logWarning } from '../Analytics';
import { featureDiscoveryApi } from '../api/featureDiscoveryApi';

import { useDataSourcesForRules } from './useDataSourcesForRules';

const { useLazyDiscoverDsFeaturesQuery } = featureDiscoveryApi;

const CONCURRENCY_LIMIT = 10;

export function useRulesSourcesWithRuler(): {
  rulesSourcesWithRuler: RulesSourceDataSource[];
  isLoading: boolean;
} {
  const { items: dataSources, isLoading: isLoadingDataSources } = useDataSourcesForRules();
  const [rulesSourcesWithRuler, setRulesSourcesWithRuler] = useState<RulesSourceDataSource[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoverDsFeatures] = useLazyDiscoverDsFeaturesQuery();

  useEffect(() => {
    // The list changes when the data source cache refreshes. Results from an earlier list must not stay.
    setRulesSourcesWithRuler((prev) => (prev.length === 0 ? prev : []));
    if (dataSources.length === 0) {
      setIsDiscovering(false);
      return;
    }

    // per-effect-run flag that prevents stale state updates after the component unmounts
    // or the effect re-runs with new dependencies
    let cancelled = false;
    setIsDiscovering(true);

    async function discoverDsFeaturesInBatches() {
      for (let i = 0; i < dataSources.length; i += CONCURRENCY_LIMIT) {
        if (cancelled) {
          return;
        }

        const batch = dataSources.slice(i, i + CONCURRENCY_LIMIT);
        await Promise.all(
          batch.map(async (ds) => {
            try {
              const { data: dsFeatures } = await discoverDsFeatures({ uid: ds.uid }, true);
              if (!cancelled && dsFeatures?.rulerConfig) {
                setRulesSourcesWithRuler((prev) => [...prev, ds]);
              }
            } catch (err) {
              logWarning('Failed to discover datasource features', { error: String(err) });
            }
          })
        );
      }

      if (!cancelled) {
        setIsDiscovering(false);
      }
    }

    discoverDsFeaturesInBatches();

    return () => {
      cancelled = true;
    };
  }, [dataSources, discoverDsFeatures]);

  return { rulesSourcesWithRuler, isLoading: isLoadingDataSources || isDiscovering };
}
