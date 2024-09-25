import { ScalarParameter, TabularParameter, Function, EntityGroup } from '@kusto/monaco-kusto';

import {
  DataSourceInstanceSettings,
  DataSourceJsonData,
  DataSourceSettings,
  PanelData,
  SelectableValue,
  TimeRange,
} from '@grafana/data';

import Datasource from '../datasource';

import { AzureLogAnalyticsMetadataTable } from './logAnalyticsMetadata';
import { AzureMonitorQuery, ResultFormat } from './query';

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
  None = '',
}

export type AzureAuthType = 'msi' | 'clientsecret' | 'workloadidentity' | 'currentuser';

export type ConcealedSecret = symbol;

interface AzureCredentialsBase {
  authType: AzureAuthType;
}

export interface AzureManagedIdentityCredentials extends AzureCredentialsBase {
  authType: 'msi';
}

export interface AzureWorkloadIdentityCredentials extends AzureCredentialsBase {
  authType: 'workloadidentity';
}

export interface AzureClientSecretCredentials extends AzureCredentialsBase {
  authType: 'clientsecret';
  azureCloud?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string | ConcealedSecret;
}
export interface AadCurrentUserCredentials extends AzureCredentialsBase {
  authType: 'currentuser';
  serviceCredentials?:
    | AzureClientSecretCredentials
    | AzureManagedIdentityCredentials
    | AzureWorkloadIdentityCredentials;
  serviceCredentialsEnabled?: boolean;
}

export type AzureCredentials =
  | AadCurrentUserCredentials
  | AzureManagedIdentityCredentials
  | AzureClientSecretCredentials
  | AzureWorkloadIdentityCredentials;

export interface AzureDataSourceJsonData extends DataSourceJsonData {
  cloudName: string;
  azureAuthType?: AzureAuthType;

  // monitor
  tenantId?: string;
  clientId?: string;
  subscriptionId?: string;
  oauthPassThru?: boolean;
  azureCredentials?: AzureCredentials;
  basicLogsEnabled?: boolean;

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

  enableSecureSocksProxy?: boolean;
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

export interface AzureMonitorMetricAvailabilityMetadata {
  timeGrain: string;
  retention: string;
}

export interface AzureMonitorLocalizedValue {
  value: string;
  localizedValue: string;
}

export interface AzureLogsVariable {
  text: string;
  value: string;
}

export interface AzureMonitorOption<T = string> {
  label: string;
  value: T;
  options?: AzureMonitorOption[];
}

export type VariableOptionGroup = { label: string; options: AzureMonitorOption[] };

export interface AzureQueryEditorFieldProps {
  data?: PanelData;
  query: AzureMonitorQuery;
  datasource: Datasource;
  subscriptionId?: string;
  variableOptionGroup: VariableOptionGroup;
  schema?: EngineSchema;
  range?: TimeRange;

  onQueryChange: (newQuery: AzureMonitorQuery) => void;
  setError: (source: string, error: AzureMonitorErrorish | undefined) => void;
}

// To avoid a type issue we redeclare the EngineSchema type from @kusto/monaco-kusto
export interface EngineSchema {
  clusterType: 'Engine';
  cluster: {
    connectionString: string;
    databases: Database[];
  };
  database: Database | undefined;
  globalScalarParameters?: ScalarParameter[];
  globalTabularParameters?: TabularParameter[];
}

export interface Database {
  name: string;
  tables: AzureLogAnalyticsMetadataTable[];
  functions: Function[];
  majorVersion: number;
  minorVersion: number;
  entityGroups: EntityGroup[];
}

export interface FormatAsFieldProps extends AzureQueryEditorFieldProps {
  inputId: string;
  options: Array<SelectableValue<ResultFormat>>;
  defaultValue: ResultFormat;
  setFormatAs: (query: AzureMonitorQuery, formatAs: ResultFormat) => AzureMonitorQuery;
  resultFormat?: ResultFormat;
  onLoad: (
    query: AzureMonitorQuery,
    defaultValue: ResultFormat,
    handleChange: (change: SelectableValue<ResultFormat>) => void
  ) => void;
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

export interface AzureGetResourceNamesQuery {
  subscriptionId: string;
  resourceGroup?: string;
  metricNamespace?: string;
  region?: string;
}

export interface AzureMonitorLocations {
  displayName: string;
  name: string;
  supportsLogs?: boolean;
}

export interface AzureMonitorProvidersResponse {
  namespace: string;
  resourceTypes: ProviderResourceType[];
}

export interface ProviderResourceType {
  resourceType: string;
  locations: string[];
  apiVersions: string[];
  capabilities: string;
}

export interface AzureAPIResponse<T> {
  value: T[];
  count?: {
    type: string;
    value: number;
  };
  status?: number;
  statusText?: string;
}

export interface Location {
  id: string;
  name: string;
  displayName: string;
  regionalDisplayName: string;
  metadata: LocationMetadata;
}

interface LocationMetadata {
  regionType: string;
  regionCategory: string;
  geographyGroup: string;
  longitude: string;
  latitude: string;
  physicalLocation: string;
  pairedRegion: LocationPairedRegion[];
}

interface LocationPairedRegion {
  name: string;
  id: string;
}

export interface Subscription {
  id: string;
  authorizationSource: string;
  subscriptionId: string;
  tenantId: string;
  displayName: string;
  state: string;
  subscriptionPolicies: {
    locationPlacementId: string;
    quotaId: string;
    spendingLimit: string;
  };
}

export interface Workspace {
  properties: {
    customerId: string;
    provisioningState: string;
    sku: {
      name: string;
    };
    retentionInDays: number;
    publicNetworkAccessForQuery: string;
    publicNetworkAccessForIngestion: string;
  };
  id: string;
  name: string;
  type: string;
  location: string;
  tags: Record<string, string>;
}

export interface Resource {
  changedTime: string;
  createdTime: string;
  extendedLocation: { name: string; type: string };
  id: string;
  identity: { principalId: string; tenantId: string; type: string; userAssignedIdentities: string[] };
  kind: string;
  location: string;
  managedBy: string;
  name: string;
  plan: { name: string; product: string; promotionCode: string; publisher: string; version: string };
  properties: Record<string, string>;
  provisioningState: string;
  sku: { capacity: number; family: string; model: string; name: string; size: string; tier: string };
  tags: Record<string, string>;
  type: string;
}

export interface ResourceGroup {
  id: string;
  location: string;
  managedBy: string;
  name: string;
  properties: { provisioningState: string };
  tags: object;
  type: string;
}

export interface Namespace {
  classification: {
    Custom: string;
    Platform: string;
    Qos: string;
  };
  id: string;
  name: string;
  properties: { metricNamespaceName: string };
  type: string;
}

export interface Metric {
  displayDescription: string;
  errorCode: string;
  errorMessage: string;
  id: string;
  name: AzureMonitorLocalizedValue;
  timeseries: Array<{ data: MetricValue[]; metadatavalues: MetricMetadataValue[] }>;
  type: string;
  unit: string;
}

interface MetricValue {
  average: number;
  count: number;
  maximum: number;
  minimum: number;
  timeStamp: string;
  total: number;
}

interface MetricMetadataValue {
  name: AzureMonitorLocalizedValue;
  value: string;
}

export type Category = {
  displayName: string;
  id: string;
  related: {
    queries: string[];
    tables: string[];
  };
};

export type CheatsheetQuery = {
  body: string;
  description: string;
  displayName: string;
  id: string;
  properties: {
    ExampleQuery: boolean;
    QueryAttributes: {
      isMultiResource: boolean;
    };
  };
  related: {
    categories: string[];
    resourceTypes: string[];
    tables: string[];
  };
  tags: {
    Topic: string[];
  };
};

export type CheatsheetQueries = {
  [key: string]: CheatsheetQuery[];
};

export type DropdownCategories = {
  [key: string]: boolean;
};
