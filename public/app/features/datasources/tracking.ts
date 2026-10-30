import { type DataSourceJsonData } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';

/**
 * Used to track data source creation via either the specific plugin page `/plugins/<the-data-source>`
 * or the general datasources page `/datasources/new`
 *
 * This event corresponds to the start event of our data source creation funnel.
 * Combined with the end event, it allows answering questions about:
 * - Conversion (percentage of user that successfully set up a data source)
 * - Time spent on the config page
 *
 * Changelog:
 * - v9.1.7 : logging datasource, datasource_uid, grafana version
 */
export const trackDataSourceCreated = (props: DataSourceCreatedProps) => {
  reportInteraction('grafana_ds_add_datasource_clicked', props);
};

type DataSourceCreatedProps = {
  grafana_version?: string;
  /** The unique id of the newly created data source */
  datasource_uid: string;
  /** The datasource id (e.g. Cloudwatch, Loki, Prometheus) */
  plugin_id: string;
  /** The plugin version (especially interesting in external plugins - core plugins are aligned with grafana version) */
  plugin_version?: string;
  /** The URL path that points to the page where the event was triggered. We are using this to be able to distinguish between the performance of different datasource edit locations. */
  path?: string;
};

/**
 * Used to track data source testing
 *
 * This event corresponds to the end event of our data source creation funnel.
 * Combined with the start event, it allows answering questions about:
 * - Conversion (percentage of user that successfully set up a data source)
 * - Time spent on the config page
 *
 * Changelog:
 * - v9.1.7 : logging datasource, datasource_uid, grafana version and success
 */
export const trackDataSourceTested = (props: DataSourceTestedProps) => {
  reportInteraction('grafana_ds_test_datasource_clicked', props);
};

type DataSourceTestedProps = {
  grafana_version?: string;
  /** The unique id of the newly created data source */
  datasource_uid: string;
  /** The datasource id (e.g. Cloudwatch, Loki, Prometheus) */
  plugin_id: string;
  /** The plugin version (especially interesting in external plugins - core plugins are aligned with grafana version) */
  plugin_version?: string;
  /** Whether or not the datasource test succeeded = the datasource was successfully configured */
  success: boolean;
  /** The URL path that points to the page where the event was triggered. We are using this to be able to distinguish between the performance of different datasource edit locations. */
  path?: string;
  /**
   * The authentication method configured on the datasource, only set for plugins listed in `authTypeResolvers`.
   * Values are plugin specific, so compare them per `plugin_id`.
   */
  authentication_type?: string;
};

type AuthTypeJsonData = DataSourceJsonData & { authenticationType?: unknown };

type AuthTypeResolver = (jsonData: AuthTypeJsonData) => string | undefined;

const GOOGLE_AUTH_TYPES = ['jwt', 'gce', 'workloadIdentityFederation', 'forwardOAuthIdentity'];

// Both Google plugins default to a service account key (`jwt`) when `authenticationType` is not set.
const googleAuthType: AuthTypeResolver = (jsonData) => {
  const authType = jsonData.authenticationType ?? 'jwt';
  return typeof authType === 'string' && GOOGLE_AUTH_TYPES.includes(authType) ? authType : undefined;
};

/**
 * Maps a plugin id to a function that reads its auth method from `jsonData`. Plugins use different fields
 * for this (e.g. `authenticationType`, `authType`, `azureAuthType`), so each plugin has to be added explicitly.
 *
 * A resolver must only return a short value from a fixed set, never raw `jsonData`.
 */
const authTypeResolvers: Record<string, AuthTypeResolver> = {
  'grafana-bigquery-datasource': googleAuthType,
  stackdriver: googleAuthType,
};

/** Returns the configured auth method for plugins listed in `authTypeResolvers`, otherwise undefined. */
export const getDataSourceAuthType = (pluginId: string, jsonData?: AuthTypeJsonData): string | undefined => {
  const resolver = Object.hasOwn(authTypeResolvers, pluginId) ? authTypeResolvers[pluginId] : undefined;
  return resolver && jsonData ? resolver(jsonData) : undefined;
};

type DataSourceGeneralTrackingProps = {
  grafana_version?: string;
  /** The unique id of the newly created data source */
  datasource_uid: string;
  /** The name of the datasource (e.g. Cloudwatch, Loki, Prometheus) */
  plugin_name: string;
  /** The URL of the page where event was triggereed from. */
  path?: string;
};

export const trackBuildDashboardDropdownClicked = (props: DataSourceGeneralTrackingProps) => {
  reportInteraction('grafana_ds_build_dashboard_dropdown_clicked', props);
};

export const trackCreateDashboardClicked = (props: DataSourceGeneralTrackingProps) => {
  reportInteraction('grafana_ds_create_dashboard_clicked', props);
};

export const trackDsConfigClicked = (item: string) => {
  reportInteraction('connections_datasources_settings_clicked', { item });
};

export const trackDsConfigUpdated = (props: { item: string; error?: unknown }) => {
  reportInteraction('connections_datasources_ds_configured', props);
};

export const trackDsSearched = (props: { query: string }) => {
  reportInteraction('connections_datasource_list_searched', {
    ...props,
    creator_team: 'grafana_plugins_catalog',
    schema_version: '1.0.0',
  });
};
