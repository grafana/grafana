import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

export function shouldShowExportOption(
  alertManagerSourceName: string,
  isDefaultPolicy: boolean,
  canReadProvisioning: boolean
) {
  const isGrafanaAM = alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME;
  return isGrafanaAM && isDefaultPolicy && canReadProvisioning;
}
