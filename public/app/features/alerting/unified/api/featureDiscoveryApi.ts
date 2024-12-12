import { RulerDataSourceConfig } from 'app/types/unified-alerting';

import {
  AlertmanagerApiFeatures,
  PromApplication,
  RulesSourceApplication,
} from '../../../../types/unified-alerting-dto';
import {
  GRAFANA_RULES_SOURCE_NAME,
  getDataSourceUID,
  getRulesDataSourceByUID,
  isGrafanaRulesSource,
} from '../utils/datasource';

import { alertingApi } from './alertingApi';
import { discoverAlertmanagerFeatures, discoverFeaturesByUid } from './buildInfo';

export const GRAFANA_RULER_CONFIG: RulerDataSourceConfig = {
  dataSourceName: 'grafana',
  apiVersion: 'legacy',
};

interface RulesSourceFeatures {
  name: string;
  uid: string;
  application: RulesSourceApplication;
  rulerConfig?: RulerDataSourceConfig;
}

export const featureDiscoveryApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    discoverAmFeatures: build.query<AlertmanagerApiFeatures, { amSourceName: string }>({
      queryFn: async ({ amSourceName }) => {
        try {
          const amFeatures = await discoverAlertmanagerFeatures(amSourceName);
          return { data: amFeatures };
        } catch (error) {
          return { error: error };
        }
      },
    }),

    discoverDsFeatures: build.query<RulesSourceFeatures, { rulesSourceName: string } | { uid: string }>({
      queryFn: async (rulesSourceIdentifier) => {
        const dataSourceUID = getDataSourceUID(rulesSourceIdentifier);
        if (!dataSourceUID) {
          return { error: new Error(`Unable to find data source for ${rulesSourceIdentifier}`) };
        }

        if (isGrafanaRulesSource(dataSourceUID)) {
          return {
            data: {
              name: GRAFANA_RULES_SOURCE_NAME,
              uid: GRAFANA_RULES_SOURCE_NAME,
              application: 'grafana',
              rulerConfig: GRAFANA_RULER_CONFIG,
            } satisfies RulesSourceFeatures,
          };
        }

        const dataSourceSettings = dataSourceUID ? getRulesDataSourceByUID(dataSourceUID) : undefined;
        if (!dataSourceSettings) {
          return { error: new Error(`Missing data source configuration for ${rulesSourceIdentifier}`) };
        }

        const features = await discoverFeaturesByUid(dataSourceSettings.uid);

        const rulerConfig = features.features.rulerApiEnabled
          ? ({
              dataSourceName: dataSourceSettings.name,
              apiVersion: features.application === PromApplication.Cortex ? 'legacy' : 'config',
            } satisfies RulerDataSourceConfig)
          : undefined;

        return {
          data: {
            name: dataSourceSettings.name,
            uid: dataSourceSettings.uid,
            application: features.application,
            rulerConfig,
          } satisfies RulesSourceFeatures,
        };
      },
    }),
  }),
});
