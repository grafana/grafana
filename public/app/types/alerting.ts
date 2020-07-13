import { SelectableValue } from '@grafana/data';

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
  optionsTemplate: string;
  type: NotifierType;
  heading: string;
  options: Option[];
  info?: string;
}

export interface NotificationChannel {
  value: string;
  label: string;
  description: string;
  type: NotifierType;
  heading: string;
  options: Option[];
  info?: string;
}

export interface NotificationChannelDTO {
  [key: string]: string | boolean | SelectableValue<string>;
  name: string;
  type: SelectableValue<string>;
  sendReminder: boolean;
  disableResolveMessage: boolean;
  frequency: string;
  settings: ChannelTypeSettings;
  isDefault: boolean;
}

export interface ChannelTypeSettings {
  [key: string]: any;
  autoResolve: true;
  httpMethod: string;
  severity: string;
  uploadImage: boolean;
}

export interface Option {
  element: 'input' | 'select' | 'switch' | 'textarea';
  inputType: string;
  label: string;
  description: string;
  placeholder: string;
  propertyName: string;
  selectOptions: Array<SelectableValue<string>>;
  showWhen: { field: string; is: string };
  required: boolean;
  validationRule: string;
}

export interface AlertRulesState {
  items: AlertRule[];
  searchQuery: string;
  isLoading: boolean;
  notificationChannels: NotificationChannel[];
}

export interface AlertNotification {
  isDefault: boolean;
  name: string;
  id: number;
  type: string;
}
