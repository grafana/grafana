import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import type { DryRunValidationResult } from '../components/import-to-gma/DryRunValidationModal';

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
        /** Merge matchers - label=value pairs that will be added to notification policies (e.g., "importedLabel=my-policy") */
        mergeMatchers: string;
      }
    >({
      query: ({ alertmanagerConfig, templateFiles = {}, mergeMatchers }) => ({
        url: `/api/convert/api/v1/alerts`,
        method: 'POST',
        body: {
          alertmanager_config: alertmanagerConfig,
          template_files: templateFiles,
        },
        headers: {
          // We use 'default' for X-Grafana-Alerting-Config-Identifier for now.
          // The backend currently only supports ONE extra configuration at a time.
          // Using 'default' allows overwriting the existing config on subsequent imports.
          // TODO: Change to 'imported' once the API supports multiple extra configurations.
          'X-Grafana-Alerting-Config-Identifier': 'default',
          // We use __grafana_managed_route__ as the label name in X-Grafana-Alerting-Merge-Matchers.
          // The value is the policy tree name chosen by the user.
          'X-Grafana-Alerting-Merge-Matchers': mergeMatchers,
        },
      }),
    }),

    /**
     * Dry-run validation for Alertmanager config import.
     * Validates the config, checks for conflicts, and returns info about resources that would be renamed.
     *
     * TODO: This endpoint doesn't exist yet. See https://github.com/grafana/alerting-squad/issues/1378
     * When implemented, it should:
     * - Validate the Alertmanager config
     * - Merge into current config (without persisting)
     * - Check for conflicts
     * - Return list of receivers/time intervals that would be renamed
     *
     * POST /api/convert/api/v1/alerts/dry-run (proposed endpoint)
     */
    dryRunAlertmanagerConfig: build.mutation<
      DryRunValidationResult,
      {
        /** Alertmanager config as JSON string or YAML string */
        alertmanagerConfig: string;
        /** Template files map */
        templateFiles?: Record<string, string>;
        /** Merge matchers - label=value pairs (e.g., "__grafana_managed_route__=my-policy") */
        mergeMatchers: string;
      }
    >({
      query: ({ alertmanagerConfig, templateFiles = {}, mergeMatchers }) => ({
        // TODO: Update URL once the backend endpoint is implemented
        url: `/api/convert/api/v1/alerts/dry-run`,
        method: 'POST',
        body: {
          alertmanager_config: alertmanagerConfig,
          template_files: templateFiles,
        },
        headers: {
          'X-Grafana-Alerting-Config-Identifier': 'default',
          'X-Grafana-Alerting-Merge-Matchers': mergeMatchers,
        },
      }),
    }),
  }),
});
