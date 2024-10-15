import { RulesSource } from 'app/types/unified-alerting';

import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { getRulesSourceName } from '../utils/datasource';

import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';

const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;

// datasource has ruler if the discovery api returns a rulerConfig
export function useHasRuler(rulesSource: RulesSource) {
  const rulerRules = useUnifiedAlertingSelector((state) => state.rulerRules);
  const rulesSourceName = getRulesSourceName(rulesSource);

  const { currentData: dsFeatures } = useDiscoverDsFeaturesQuery({ rulesSourceName });

  const hasRuler = Boolean(dsFeatures?.rulerConfig);
  const rulerRulesLoaded = Boolean(rulerRules[rulesSourceName]?.result);

  return { hasRuler, rulerRulesLoaded };
}
