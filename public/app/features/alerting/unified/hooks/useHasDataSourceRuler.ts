import { featureDiscoveryApi } from '../api/featureDiscoveryApi';

const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;

export function useHasDataSourceRuler(dataSourceUid: string): {
  hasRuler: boolean;
  isLoading: boolean;
} {
  const { data: dsFeatures, isLoading } = useDiscoverDsFeaturesQuery({ uid: dataSourceUid });

  const hasRuler = Boolean(dsFeatures?.rulerConfig);

  return { hasRuler, isLoading };
}
