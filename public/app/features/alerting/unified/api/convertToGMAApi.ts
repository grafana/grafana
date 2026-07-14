import { type RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

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
        /** JSON-encoded notification settings applied to all imported alerting rules */
        notificationSettings?: string;
      }
    >({
      query: ({
        payload,
        targetFolderUID,
        pauseRecordingRules,
        pauseAlerts,
        dataSourceUID,
        targetDatasourceUID,
        notificationSettings,
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
          ...(notificationSettings ? { 'X-Grafana-Alerting-Notification-Settings': notificationSettings } : {}),
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
        /** If true, merge the imported config into the main Grafana config as editable resources */
        promote?: boolean;
      }
    >({
      query: ({ alertmanagerConfig, templateFiles = {}, configIdentifier, forceReplace, promote }) => ({
        url: `/api/convert/api/v1/alerts`,
        method: 'POST',
        body: {
          alertmanager_config: alertmanagerConfig,
          template_files: templateFiles,
        },
        headers: {
          // The config identifier is the name of the extra configuration (policy tree name)
          'X-Grafana-Alerting-Config-Identifier': configIdentifier,
          ...(forceReplace ? { 'X-Grafana-Alerting-Config-Force-Replace': 'true' } : {}),
          ...(promote ? { 'X-Grafana-Alerting-Promote': 'true' } : {}),
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
        /** If true, validate the merge into the main config (and the caller's permissions) */
        promote?: boolean;
      }
    >({
      query: ({ alertmanagerConfig, templateFiles = {}, configIdentifier, promote }) => ({
        url: `/api/convert/api/v1/alerts`,
        method: 'POST',
        body: {
          alertmanager_config: alertmanagerConfig,
          template_files: templateFiles,
        },
        headers: {
          'X-Grafana-Alerting-Config-Identifier': configIdentifier,
          'X-Grafana-Alerting-Dry-Run': 'true',
          // Always force-replace during dry-run to avoid 409 conflicts —
          // we want to validate the config regardless of existing identifiers
          'X-Grafana-Alerting-Config-Force-Replace': 'true',
          // When promoting, the dry-run also validates the merge and the caller's
          // create-permissions for every resource type in the config.
          ...(promote ? { 'X-Grafana-Alerting-Promote': 'true' } : {}),
        },
      }),
    }),
  }),
});
