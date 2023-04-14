import { SelectableValue } from '@grafana/data';
import { IconName } from '@grafana/ui';

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
  stateIcon: IconName;
  stateClass: string;
  stateAge: string;
  url: string;
  info?: string;
  executionError?: string;
  evalDate?: string;
  evalData?: { noData?: boolean; evalMatches?: any };
}

export type GrafanaNotifierType =
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

export type CloudNotifierType =
  | 'email'
  | 'pagerduty'
  | 'pushover'
  | 'slack'
  | 'opsgenie'
  | 'victorops'
  | 'webhook'
  | 'wechat';

export type NotifierType = GrafanaNotifierType | CloudNotifierType;
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
  element:
    | 'input'
    | 'select'
    | 'checkbox'
    | 'textarea'
    | 'subform'
    | 'subform_array'
    | 'key_value_map'
    | 'string_array';
  inputType: string;
  label: string;
  description: string;
  placeholder: string;
  propertyName: string;
  required: boolean;
  secure: boolean;
  selectOptions?: Array<SelectableValue<string>> | null;
  showWhen: { field: string; is: string };
  validationRule: string;
  subformOptions?: NotificationChannelOption[];
  dependsOn: string;
}

export interface NotificationChannelState {
  notificationChannelTypes: NotificationChannelType[];
  notifiers: NotifierDTO[];
  notificationChannel: any;
}

export interface NotifierStatus {
  lastNotifyAttemptError?: null | string;
  lastNotifyAttempt: string;
  lastNotifyAttemptDuration: string;
  name: string;
  sendResolved?: boolean;
}

export interface NotifiersState {
  [key: string]: NotifierStatus[]; // key is the notifier type
}

export interface ReceiverState {
  active: boolean;
  notifiers: NotifiersState;
  errorCount: number; // errors by receiver
}

export interface ReceiversState {
  [key: string]: ReceiverState;
}

export interface ContactPointsState {
  receivers: ReceiversState;
  errorCount: number;
}

export interface ReceiversStateDTO {
  active: boolean;
  integrations: NotifierStatus[];
  name: string;
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

export interface AnnotationItemDTO {
  id: number;
  alertId: number;
  alertName: string;
  dashboardId: number;
  panelId: number;
  userId: number;
  newState: string;
  prevState: string;
  created: number;
  updated: number;
  time: number;
  timeEnd: number;
  text: string;
  tags: string[];
  login: string;
  email: string;
  avatarUrl: string;
  data: any;
}
