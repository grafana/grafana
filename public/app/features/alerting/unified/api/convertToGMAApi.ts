import { type RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import type { ConvertAlertmanagerResponse } from '../components/import-to-gma/types';

import { alertingApi } from './alertingApi';

export const convertToGMAApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
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

    /** Stage an Alertmanager config (contact points, policies, templates, time intervals) in Grafana. */
    convertAlertmanagerConfig: build.mutation<
      ConvertAlertmanagerResponse,
      {
        alertmanagerConfig: string;
        templateFiles?: Record<string, string>;
        /** Names the staged extra config, and the managed policy tree it produces (e.g. "prometheus-prod"). */
        configIdentifier: string;
        /** Overwrite an existing staged config even when its identifier differs. */
        forceReplace?: boolean;
        /** Merge straight into the live config as editable resources instead of only staging. */
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
          'X-Grafana-Alerting-Config-Identifier': configIdentifier,
          ...(forceReplace ? { 'X-Grafana-Alerting-Config-Force-Replace': 'true' } : {}),
          ...(promote ? { 'X-Grafana-Alerting-Promote': 'true' } : {}),
        },
      }),
      // Staged imports land on the AM config's extra_config, so the config query has to refetch —
      // otherwise the Import tab renders its cached, pre-import config and shows the empty state.
      invalidatesTags: ['AlertmanagerConfiguration'],
    }),

    /**
     * Validate an Alertmanager config without saving it, reporting conflicts and resources that would be
     * renamed. Same endpoint as the real import, distinguished only by the dry-run header.
     */
    dryRunAlertmanagerConfig: build.mutation<
      ConvertAlertmanagerResponse,
      {
        alertmanagerConfig: string;
        templateFiles?: Record<string, string>;
        configIdentifier: string;
        /** Also validate the merge into the live config, and the caller's permissions for it. */
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
          // Force-replace so validation isn't blocked by a 409 from an existing identifier.
          'X-Grafana-Alerting-Config-Force-Replace': 'true',
          ...(promote ? { 'X-Grafana-Alerting-Promote': 'true' } : {}),
        },
      }),
    }),

    /** Discard a staged Alertmanager config. The live Grafana Alertmanager config is not affected. */
    deleteStagedAlertmanagerConfig: build.mutation<void, { configIdentifier: string }>({
      query: ({ configIdentifier }) => ({
        url: `/api/convert/api/v1/alerts`,
        method: 'DELETE',
        headers: {
          'X-Grafana-Alerting-Config-Identifier': configIdentifier,
        },
      }),
      // The staged config lives inside the AM config, so refetching it removes the staged card.
      invalidatesTags: ['AlertmanagerConfiguration'],
    }),
  }),
});
