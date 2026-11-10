import { type DataSourceInstanceSettings } from '@grafana/data';
import { type RulesSource } from 'app/types/unified-alerting';

import { GRAFANA_RULES_SOURCE_NAME } from './constants';

export function getRulesSourceName(rulesSource: RulesSource): string {
  return isCloudRulesSource(rulesSource) ? rulesSource.name : rulesSource;
}

export function isCloudRulesSource(rulesSource: RulesSource | string): rulesSource is DataSourceInstanceSettings {
  return rulesSource !== GRAFANA_RULES_SOURCE_NAME;
}

export function isGrafanaRulesSource(
  rulesSource: RulesSource | string
): rulesSource is typeof GRAFANA_RULES_SOURCE_NAME {
  return rulesSource === GRAFANA_RULES_SOURCE_NAME;
}
