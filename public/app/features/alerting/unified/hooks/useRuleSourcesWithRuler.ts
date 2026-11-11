import { useEffect, useState } from 'react';

import { type RulesSourceDataSource } from '@grafana/alerting/internal';

import { logWarning } from '../Analytics';
import { featureDiscoveryApi } from '../api/featureDiscoveryApi';

import { useDataSourcesForRules } from './useDataSourcesForRules';

const { useLazyDiscoverDsFeaturesQuery } = featureDiscoveryApi;

const CONCURRENCY_LIMIT = 10;

const noRulesSources: RulesSourceDataSource[] = [];

interface DiscoveryState {
  forList?: RulesSourceDataSource[];
  withRuler: RulesSourceDataSource[];
  isDone: boolean;
}

export function useRulesSourcesWithRuler(): {
  rulesSourcesWithRuler: RulesSourceDataSource[];
  isLoading: boolean;
} {
  const { items: dataSources, isLoading: isLoadingDataSources } = useDataSourcesForRules();
  const [discovery, setDiscovery] = useState<DiscoveryState>({ withRuler: noRulesSources, isDone: false });
  const [discoverDsFeatures] = useLazyDiscoverDsFeaturesQuery();

  useEffect(() => {
    // An empty list needs no discovery. Setting state for it would also re-render forever if the list
    // hook returns a new empty array on every render.
    if (dataSources.length === 0) {
      return;
    }
    setDiscovery({ forList: dataSources, withRuler: noRulesSources, isDone: false });

    // per-effect-run flag that prevents stale state updates after the component unmounts
    // or the effect re-runs with new dependencies
    let cancelled = false;

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
                setDiscovery((prev) =>
                  prev.forList === dataSources ? { ...prev, withRuler: [...prev.withRuler, ds] } : prev
                );
              }
            } catch (err) {
              logWarning('Failed to discover datasource features', { error: String(err) });
            }
          })
        );
      }

      if (!cancelled) {
        setDiscovery((prev) => (prev.forList === dataSources ? { ...prev, isDone: true } : prev));
      }
    }

    discoverDsFeaturesInBatches();

    return () => {
      cancelled = true;
    };
  }, [dataSources, discoverDsFeatures]);

  if (dataSources.length === 0) {
    return { rulesSourcesWithRuler: noRulesSources, isLoading: isLoadingDataSources };
  }

  // Derived during render so that a list the effect has not processed yet never reads as ready,
  // and results from an earlier list are never returned.
  const isCurrentList = discovery.forList === dataSources;

  return {
    rulesSourcesWithRuler: isCurrentList ? discovery.withRuler : noRulesSources,
    isLoading: isLoadingDataSources || !isCurrentList || !discovery.isDone,
  };
}
