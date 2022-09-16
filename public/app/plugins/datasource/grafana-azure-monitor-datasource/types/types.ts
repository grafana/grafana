import {
  DataSourceInstanceSettings,
  DataSourceJsonData,
  DataSourceSettings,
  PanelData,
  TableData,
} from '@grafana/data';

import Datasource from '../datasource';

import { AzureMonitorQuery } from './query';

export type AzureDataSourceSettings = DataSourceSettings<AzureDataSourceJsonData, AzureDataSourceSecureJsonData>;
export type AzureDataSourceInstanceSettings = DataSourceInstanceSettings<AzureDataSourceJsonData>;

export interface DatasourceValidationResult {
  status: 'success' | 'error';
  message: string;
  title?: string;
}

/**
 * Azure clouds known to Azure Monitor.
 */
export enum AzureCloud {
  Public = 'AzureCloud',
  China = 'AzureChinaCloud',
  USGovernment = 'AzureUSGovernment',
  Germany = 'AzureGermanCloud',
  None = '',
}

export type AzureAuthType = 'msi' | 'clientsecret';

export type ConcealedSecret = symbol;

interface AzureCredentialsBase {
  authType: AzureAuthType;
  defaultSubscriptionId?: string;
}

export interface AzureManagedIdentityCredentials extends AzureCredentialsBase {
  authType: 'msi';
}

export interface AzureClientSecretCredentials extends AzureCredentialsBase {
  authType: 'clientsecret';
  azureCloud?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string | ConcealedSecret;
}

export type AzureCredentials = AzureManagedIdentityCredentials | AzureClientSecretCredentials;

export interface AzureDataSourceJsonData extends DataSourceJsonData {
  cloudName: string;
  azureAuthType?: AzureAuthType;

  // monitor
  tenantId?: string;
  clientId?: string;
  subscriptionId?: string;

  // logs
  /** @deprecated Azure Logs credentials */
  azureLogAnalyticsSameAs?: boolean;
  /** @deprecated Azure Logs credentials */
  logAnalyticsTenantId?: string;
  /** @deprecated Azure Logs credentials */
  logAnalyticsClientId?: string;
  /** @deprecated Azure Logs credentials */
  logAnalyticsSubscriptionId?: string;
  /** @deprecated Azure Logs credentials */
  logAnalyticsDefaultWorkspace?: string;

  // App Insights
  appInsightsAppId?: string;
}

export interface AzureDataSourceSecureJsonData {
  clientSecret?: string;
  appInsightsApiKey?: string;
}

// Represents an errors that come back from frontend requests.
// Not totally sure how accurate this type is.
export type AzureMonitorErrorish = Error | string | React.ReactElement;

// Azure Monitor API Types
export interface AzureMonitorMetricsMetadataResponse {
  value: AzureMonitorMetricMetadataItem[];
}

export interface AzureMonitorMetricMetadataItem {
  id: string;
  resourceId: string;
  primaryAggregationType: string;
  supportedAggregationTypes: string[];
  name: AzureMonitorLocalizedValue;
  dimensions?: AzureMonitorLocalizedValue[];
  metricAvailabilities?: AzureMonitorMetricAvailabilityMetadata[];
}

export interface AzureMonitorMetricNamespacesResponse {
  value: AzureMonitorMetricNamespaceItem[];
}

export interface AzureMonitorMetricNamespaceItem {
  name: string;
  properties: { metricNamespacename: string };
}

export interface AzureMonitorMetricNamesResponse {
  value: AzureMonitorMetricNameItem[];
}

export interface AzureMonitorMetricNameItem {
  name: { value: string; localizedValue: string };
}

export interface AzureMonitorMetricAvailabilityMetadata {
  timeGrain: string;
  retention: string;
}

export interface AzureMonitorLocalizedValue {
  value: string;
  localizedValue: string;
}

export interface AzureMonitorResourceGroupsResponse {
  data: {
    value: Array<{ name: string }>;
  };
  status: number;
  statusText: string;
}

export interface AzureLogsVariable {
  text: string;
  value: string;
}

export interface AzureLogsTableData extends TableData {
  columns: AzureLogsTableColumn[];
  rows: any[];
  type: string;
}

export interface AzureLogsTableColumn {
  text: string;
  type: string;
}

export interface AzureMonitorOption<T = string> {
  label: string;
  value: T;
  options?: AzureMonitorOption[];
}

export interface AzureQueryEditorFieldProps {
  data?: PanelData;
  query: AzureMonitorQuery;
  datasource: Datasource;
  subscriptionId?: string;
  variableOptionGroup: { label: string; options: AzureMonitorOption[] };

  onQueryChange: (newQuery: AzureMonitorQuery) => void;
  setError: (source: string, error: AzureMonitorErrorish | undefined) => void;
}

export interface AzureResourceSummaryItem {
  subscriptionName: string;
  resourceGroupName: string | undefined;
  resourceName: string | undefined;
}

export interface RawAzureSubscriptionItem {
  subscriptionName: string;
  subscriptionId: string;
}

export interface RawAzureResourceGroupItem {
  resourceGroupURI: string;
  resourceGroupName: string;
}

export interface RawAzureResourceItem {
  id: string;
  name: string;
  subscriptionId: string;
  resourceGroup: string;
  type: string;
  location: string;
}

export interface AzureGraphResponse<T = unknown> {
  data: T;
  // skipToken is used for pagination, to get the next page
  $skipToken?: string;
}

// https://docs.microsoft.com/en-us/rest/api/azureresourcegraph/resourcegraph(2021-03-01)/resources/resources#queryrequestoptions
export interface AzureResourceGraphOptions {
  $skip: number;
  $skipToken: string;
  $top: number;
  allowPartialScopes: boolean;
  resultFormat: 'objectArray' | 'table';
}

// Azure Monitor Metrics query API data fetcher argument types.
// The types prefixed by Legacy are applicable to pre-version 9 of Grafana
// that do not have a resourceUri, instead the resourceUri is built up from
// the subscription, resource group, metric definition (a.k.a. resource type)
// and the resource name.
export type GetMetricNamespacesQuery = AzureGetMetricNamespacesQuery | LegacyAzureGetMetricNamespacesQuery;
export type GetMetricNamesQuery = AzureGetMetricNamesQuery | LegacyAzureGetMetricNamesQuery;
export type GetMetricMetadataQuery = AzureGetMetricMetadataQuery | LegacyAzureGetMetricMetadataQuery;

export interface AzureGetMetricNamespacesQuery {
  resourceUri: string;
}
export interface LegacyAzureGetMetricNamespacesQuery {
  subscription: string;
  resourceGroup: string;
  metricNamespace?: string;
  resourceName?: string;
}

export interface AzureGetMetricNamesQuery {
  resourceUri: string;
  metricNamespace?: string;
  customNamespace?: string;
}

export interface LegacyAzureGetMetricNamesQuery {
  subscription: string;
  resourceGroup: string;
  resourceName: string;
  metricNamespace: string;
  customNamespace?: string;
}

export interface AzureGetMetricMetadataQuery {
  resourceUri: string;
  metricNamespace: string;
  customNamespace?: string;
  metricName: string;
}

export interface LegacyAzureGetMetricMetadataQuery {
  subscription: string;
  resourceGroup: string;
  resourceName: string;
  metricNamespace: string;
  customNamespace?: string;
  metricName: string;
}
