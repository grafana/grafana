import { useEffect, useState } from 'react';

import type { DataSourceInstanceSettings } from '@grafana/data/types';

import { logWarning } from '../Analytics';
import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { getRulesDataSources } from '../utils/datasource';

const { useLazyDiscoverDsFeaturesQuery } = featureDiscoveryApi;

const CONCURRENCY_LIMIT = 10;

export function useRulesSourcesWithRuler(): {
  rulesSourcesWithRuler: DataSourceInstanceSettings[];
  isLoading: boolean;
} {
  const [rulesSourcesWithRuler, setRulesSourcesWithRuler] = useState<DataSourceInstanceSettings[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [discoverDsFeatures] = useLazyDiscoverDsFeaturesQuery();

  useEffect(() => {
    const dataSources = getRulesDataSources();
    if (dataSources.length === 0) {
      return;
    }

    // per-effect-run flag that prevents stale state updates after the component unmounts
    // or the effect re-runs with new dependencies
    let cancelled = false;
    setIsLoading(true);

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
        setIsLoading(false);
      }
    }

    discoverDsFeaturesInBatches();

    return () => {
      cancelled = true;
    };
  }, [discoverDsFeatures]);

  return { rulesSourcesWithRuler, isLoading };
}
