import { DataSourceInstanceSettings, DataSourceJsonData } from '@grafana/data';
import { RulerDataSourceConfig } from 'app/types/unified-alerting';

import { AlertmanagerApiFeatures, PromApiFeatures, PromApplication } from '../../../../types/unified-alerting-dto';
import { getRulesDataSource, getRulesDataSourceByUID } from '../utils/datasource';

import { alertingApi } from './alertingApi';
import { discoverAlertmanagerFeatures, discoverFeaturesByUid } from './buildInfo';

export const GRAFANA_RULER_CONFIG: RulerDataSourceConfig = {
  dataSourceName: 'grafana',
  apiVersion: 'legacy',
};

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

    discoverDsFeatures: build.query<
      {
        rulerConfig?: RulerDataSourceConfig;
        features: PromApiFeatures;
        dataSourceSettings: DataSourceInstanceSettings<DataSourceJsonData>;
      },
      { rulesSourceName: string } | { uid: string }
    >({
      queryFn: async (rulesSourceIdentifier) => {
        const dataSourceSettings =
          'uid' in rulesSourceIdentifier
            ? getRulesDataSourceByUID(rulesSourceIdentifier.uid)
            : getRulesDataSource(rulesSourceIdentifier.rulesSourceName);
        if (!dataSourceSettings) {
          return { error: new Error(`Missing data source configuration for ${rulesSourceIdentifier}`) };
        }

        const features = await discoverFeaturesByUid(dataSourceSettings.uid);

        const rulerConfig = features.features.rulerApiEnabled
          ? ({
              dataSourceName: dataSourceSettings.name,
              apiVersion: features.application === PromApplication.Mimir ? 'config' : 'legacy',
            } satisfies RulerDataSourceConfig)
          : undefined;

        return {
          data: {
            rulerConfig,
            features,
            dataSourceSettings,
          },
        };
      },
    }),
  }),
});
