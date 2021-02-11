import { DataFrame, DataQuery, PanelData, SelectableValue, TimeRange } from '@grafana/data';
import { PanelQueryRunner } from '../features/query/state/PanelQueryRunner';
import { QueryGroupOptions } from './query';
import { ExpressionQuery } from '../features/expressions/types';

export interface AlertRuleDTO {
  id: number;
  dashboardId: number;
  dashboardUid: string;
  dashboardSlug: string;
  panelId: number;
  name: string;
  state: string;
  newStateDate: string;
  evalDate: string;
  evalData?: { noData?: boolean; evalMatches?: any };
  executionError: string;
  url: string;
}

export interface AlertRule {
  id: number;
  dashboardId: number;
  dashboardUid?: string;
  dashboardSlug?: string;
  panelId: number;
  name: string;
  state: string;
  newStateDate?: string;
  stateText: string;
  stateIcon: string;
  stateClass: string;
  stateAge: string;
  url: string;
  info?: string;
  executionError?: string;
  evalDate?: string;
  evalData?: { noData?: boolean; evalMatches?: any };
}

export type NotifierType =
  | 'discord'
  | 'hipchat'
  | 'email'
  | 'sensu'
  | 'sensugo'
  | 'googlechat'
  | 'threema'
  | 'teams'
  | 'slack'
  | 'pagerduty'
  | 'prometheus-alertmanager'
  | 'telegram'
  | 'opsgenie'
  | 'dingding'
  | 'webhook'
  | 'victorops'
  | 'pushover'
  | 'LINE'
  | 'kafka';

export interface NotifierDTO {
  name: string;
  description: string;
  type: NotifierType;
  heading: string;
  options: NotificationChannelOption[];
  info?: string;
  secure?: boolean;
}

export interface NotificationChannelType {
  value: string;
  label: string;
  description: string;
  type: NotifierType;
  heading: string;
  options: NotificationChannelOption[];
  info?: string;
}

export interface NotificationChannelDTO {
  [key: string]: string | boolean | number | SelectableValue<string>;
  id: number;
  name: string;
  type: SelectableValue<string>;
  sendReminder: boolean;
  disableResolveMessage: boolean;
  frequency: string;
  settings: ChannelTypeSettings;
  secureSettings: NotificationChannelSecureSettings;
  secureFields: NotificationChannelSecureFields;
  isDefault: boolean;
}

export type NotificationChannelSecureSettings = Record<string, string | number>;
export type NotificationChannelSecureFields = Record<string, boolean>;

export interface ChannelTypeSettings {
  [key: string]: any;
  autoResolve: true;
  httpMethod: string;
  severity: string;
  uploadImage: boolean;
}

export interface NotificationChannelOption {
  element: 'input' | 'select' | 'checkbox' | 'textarea';
  inputType: string;
  label: string;
  description: string;
  placeholder: string;
  propertyName: string;
  required: boolean;
  secure: boolean;
  selectOptions?: Array<SelectableValue<string>>;
  showWhen: { field: string; is: string };
  validationRule: string;
}

export interface NotificationChannelState {
  notificationChannelTypes: NotificationChannelType[];
  notifiers: NotifierDTO[];
  notificationChannel: any;
}

export interface AlertRulesState {
  items: AlertRule[];
  searchQuery: string;
  isLoading: boolean;
}

export interface AlertNotification {
  isDefault: boolean;
  name: string;
  id: number;
  type: string;
}

export interface AlertDefinitionState {
  uiState: AlertDefinitionUiState;
  alertDefinition: AlertDefinition;
  queryRunner?: PanelQueryRunner;
  data: PanelData[];
  alertDefinitions: AlertDefinition[];
  getInstances: () => DataFrame[];
  getQueryOptions: () => QueryGroupOptions;
}

export interface AlertDefinition {
  id: number;
  uid: string;
  title: string;
  description: string;
  condition: string;
  data: any[];
  intervalSeconds: number;
}

export interface AlertDefinitionDTO extends AlertDefinition {
  queryType: string;
  refId: string;
  relativeTimeRange: TimeRange;
  orgId: number;
  updated: string;
  version: number;
}

export interface AlertDefinitionQueryModel {
  model: DataQuery | ExpressionQuery;
}

export interface AlertDefinitionUiState {
  rightPaneSize: number;
  topPaneSize: number;
}
