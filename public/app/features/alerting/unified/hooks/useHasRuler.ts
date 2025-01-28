import { RulesSource } from 'app/types/unified-alerting';

import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { getRulesSourceName } from '../utils/datasource';

const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;

// datasource has ruler if the discovery api returns a rulerConfig
export function useHasRuler(rulesSource: RulesSource) {
  const rulesSourceName = getRulesSourceName(rulesSource);

  const { currentData: dsFeatures } = useDiscoverDsFeaturesQuery({ rulesSourceName });
  const hasRuler = Boolean(dsFeatures?.rulerConfig);

  return { hasRuler, rulerConfig: dsFeatures?.rulerConfig };
}
