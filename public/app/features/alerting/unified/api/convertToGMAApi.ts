import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import type { ConvertAlertmanagerResponse } from '../components/import-to-gma/types';

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
     * Import Alertmanager config (contact points, policies, templates, time intervals) to Grafana.
     * POST /api/convert/api/v1/alerts
     *
     * Supports force-replace via X-Grafana-Alerting-Config-Force-Replace header
     * to overwrite an existing config with a different identifier.
     */
    convertAlertmanagerConfig: build.mutation<
      ConvertAlertmanagerResponse,
      {
        /** Alertmanager config as JSON string or YAML string */
        alertmanagerConfig: string;
        /** Template files map */
        templateFiles?: Record<string, string>;
        /** Configuration identifier - used as the extra config name (e.g., "prometheus-prod") */
        configIdentifier: string;
        /** If true, forcibly replace existing configuration regardless of identifier */
        forceReplace?: boolean;
      }
    >({
      query: ({ alertmanagerConfig, templateFiles = {}, configIdentifier, forceReplace }) => ({
        url: `/api/convert/api/v1/alerts`,
        method: 'POST',
        body: {
          alertmanager_config: alertmanagerConfig,
          template_files: templateFiles,
        },
        headers: {
          // The config identifier is the name of the extra configuration (policy tree name)
          'X-Grafana-Alerting-Config-Identifier': configIdentifier,
          // TODO: Remove this header once the backend no longer requires it
          'X-Grafana-Alerting-Merge-Matchers': `__grafana_managed_route__=${configIdentifier}`,
          ...(forceReplace ? { 'X-Grafana-Alerting-Config-Force-Replace': 'true' } : {}),
        },
      }),
    }),

    /**
     * Dry-run validation for Alertmanager config import.
     * Uses the same endpoint as the real import but with the X-Grafana-Alerting-Dry-Run header.
     * Validates the config, checks for conflicts, and returns info about resources that would be renamed
     * without actually saving anything.
     *
     * POST /api/convert/api/v1/alerts (with X-Grafana-Alerting-Dry-Run: true)
     * Returns 200 OK on success (vs 202 Accepted for real imports)
     */
    dryRunAlertmanagerConfig: build.mutation<
      ConvertAlertmanagerResponse,
      {
        /** Alertmanager config as JSON string or YAML string */
        alertmanagerConfig: string;
        /** Template files map */
        templateFiles?: Record<string, string>;
        /** Configuration identifier - used as the extra config name */
        configIdentifier: string;
      }
    >({
      query: ({ alertmanagerConfig, templateFiles = {}, configIdentifier }) => ({
        url: `/api/convert/api/v1/alerts`,
        method: 'POST',
        body: {
          alertmanager_config: alertmanagerConfig,
          template_files: templateFiles,
        },
        headers: {
          'X-Grafana-Alerting-Config-Identifier': configIdentifier,
          // TODO: Remove this header once the backend no longer requires it
          'X-Grafana-Alerting-Merge-Matchers': `__grafana_managed_route__=${configIdentifier}`,
          'X-Grafana-Alerting-Dry-Run': 'true',
          // Always force-replace during dry-run to avoid 409 conflicts —
          // we want to validate the config regardless of existing identifiers
          'X-Grafana-Alerting-Config-Force-Replace': 'true',
        },
      }),
    }),
  }),
});
