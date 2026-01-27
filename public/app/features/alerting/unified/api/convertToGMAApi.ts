import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { alertingApi } from './alertingApi';

export const convertToGMAApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * Convert Prometheus/Mimir rules to Grafana-managed alert rules
     * POST /api/convert/prometheus/config/v1/rules
     */
    convertToGMA: build.mutation<
      void,
      {
        targetFolderUID?: string;
        dataSourceUID: string;
        pauseRecordingRules?: boolean;
        pauseAlerts?: boolean;
        payload: RulerRulesConfigDTO;
        /** Target data source UID to store recording rules in */
        targetDatasourceUID?: string;
        /** Extra labels to add to all imported rules (format: key=value,key2=value2) */
        extraLabels?: string;
      }
    >({
      query: ({
        payload,
        targetFolderUID,
        pauseRecordingRules,
        pauseAlerts,
        dataSourceUID,
        targetDatasourceUID,
        extraLabels,
      }) => ({
        url: `/api/convert/prometheus/config/v1/rules`,
        method: 'POST',
        body: payload,
        headers: {
          'X-Grafana-Alerting-Datasource-UID': dataSourceUID,
          'X-Grafana-Alerting-Recording-Rules-Paused': pauseRecordingRules,
          'X-Grafana-Alerting-Alert-Rules-Paused': pauseAlerts,
          'X-Disable-Provenance': true,
          ...(targetFolderUID ? { 'X-Grafana-Alerting-Folder-UID': targetFolderUID } : {}),
          ...(targetDatasourceUID ? { 'X-Grafana-Alerting-Target-Datasource-UID': targetDatasourceUID } : {}),
          ...(extraLabels ? { 'X-Grafana-Alerting-Extra-Labels': extraLabels } : {}),
        },
      }),
    }),

    /**
     * Convert Alertmanager config (contact points, policies, templates, time intervals) to Grafana
     * POST /api/convert/api/v1/alerts
     */
    convertAlertmanagerConfig: build.mutation<
      void,
      {
        /** Alertmanager config as JSON string or YAML string */
        alertmanagerConfig: string;
        /** Template files map */
        templateFiles?: Record<string, string>;
        /** Identifier for the imported config (default: "default") */
        configIdentifier?: string;
        /** Merge matchers - label=value pairs that will be added to notification policies (e.g., "importedLabel=my-policy") */
        mergeMatchers: string;
      }
    >({
      query: ({ alertmanagerConfig, templateFiles = {}, configIdentifier = 'default', mergeMatchers }) => ({
        url: `/api/convert/api/v1/alerts`,
        method: 'POST',
        body: {
          alertmanager_config: alertmanagerConfig,
          template_files: templateFiles,
        },
        headers: {
          'X-Grafana-Alerting-Config-Identifier': configIdentifier,
          'X-Grafana-Alerting-Merge-Matchers': mergeMatchers,
        },
      }),
    }),
  }),
});
