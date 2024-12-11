import { useEffect, useState } from 'react';

import { DataSourceInstanceSettings } from '@grafana/data';

import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { getRulesDataSources } from '../utils/datasource';

const { useLazyDiscoverDsFeaturesQuery } = featureDiscoveryApi;

export function useRulesSourcesWithRuler(): {
  rulesSourcesWithRuler: DataSourceInstanceSettings[];
  isLoading: boolean;
} {
  const [rulesSourcesWithRuler, setRulesSourcesWithRuler] = useState<DataSourceInstanceSettings[]>([]);
  const [discoverDsFeatures, { isLoading }] = useLazyDiscoverDsFeaturesQuery();

  useEffect(() => {
    const dataSources = getRulesDataSources();
    dataSources.forEach(async (ds) => {
      const { data: dsFeatures } = await discoverDsFeatures({ uid: ds.uid }, true);
      if (dsFeatures?.rulerConfig) {
        setRulesSourcesWithRuler((prev) => [...prev, ds]);
      }
    });
  }, [discoverDsFeatures]);

  return { rulesSourcesWithRuler, isLoading };
}
