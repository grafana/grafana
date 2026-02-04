import { GrafanaRulesSourceSymbol, RulesSource } from 'app/types/unified-alerting';

import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { getRulesSourceName } from '../utils/datasource';

const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;

// datasource has ruler if the discovery api returns a rulerConfig
/** @deprecated use useHasRulerV2 instead */
export function useHasRuler(rulesSource: RulesSource) {
  const rulesSourceName = getRulesSourceName(rulesSource);

  const { currentData: dsFeatures } = useDiscoverDsFeaturesQuery({ rulesSourceName });
  const hasRuler = Boolean(dsFeatures?.rulerConfig);

  return { hasRuler, rulerConfig: dsFeatures?.rulerConfig };
}

export function useHasRulerV2(ruleUid: string | typeof GrafanaRulesSourceSymbol) {
  const { currentData: dsFeatures } = useDiscoverDsFeaturesQuery({ uid: ruleUid });
  const hasRuler = Boolean(dsFeatures?.rulerConfig);

  return { hasRuler, rulerConfig: dsFeatures?.rulerConfig };
}
