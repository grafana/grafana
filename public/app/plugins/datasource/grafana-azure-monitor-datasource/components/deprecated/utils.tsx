import { config } from '@grafana/runtime';
import { gt, valid } from 'semver';

import { AzureDataSourceSettings } from '../../types';

export function isAppInsightsConfigured(options: AzureDataSourceSettings) {
  return !!(options.jsonData.appInsightsAppId && options.secureJsonFields.appInsightsApiKey);
}

export function gtGrafana9() {
  // AppInsights configuration will be removed with Grafana 9
  return valid(config.buildInfo.version) && gt(config.buildInfo.version, '9.0.0-beta1');
}
