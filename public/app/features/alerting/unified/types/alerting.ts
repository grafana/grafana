import { ValidationRule } from 'react-hook-form';

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
  | 'email'
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
  | 'kafka'
  | 'wecom'
  | 'webex'
  | 'mqtt'
  | 'oncall'
  | 'sns';

export type CloudNotifierType =
  | 'oncall' // Only FE implementation for now
  | 'email'
  | 'pagerduty'
  | 'pushover'
  | 'slack'
  | 'opsgenie'
  | 'victorops'
  | 'webhook'
  | 'wechat'
  | 'webex'
  | 'telegram'
  | 'sns'
  | 'discord'
  | 'msteams'
  | 'jira';

export type NotifierType = GrafanaNotifierType | CloudNotifierType;

/**
 * Represents a specific version of a notifier integration
 * Used for integration versioning during Single Alert Manager migration
 */
export interface NotifierVersion {
  version: string;
  label: string;
  description: string;
  options: NotificationChannelOption[];
  /** Whether this version can be used to create new integrations */
  canCreate?: boolean;
}

export interface NotifierDTO<T = NotifierType> {
  name: string;
  description: string;
  type: T;
  heading: string;
  options: NotificationChannelOption[];
  info?: string;
  secure?: boolean;
  /**
   * Available versions for this notifier from the backend
   * Each version contains version-specific options and metadata
   */
  versions?: NotifierVersion[];
  /**
   * The default version that the backend will use when creating new integrations.
   * Returned by the backend from /api/alert-notifiers?version=2
   *
   * - "v1" for most notifiers (modern Grafana version)
   * - "v0mimir1" for legacy-only notifiers (e.g., WeChat)
   *
   * Note: Currently not used in the frontend. The backend handles version
   * selection automatically. Could be used in the future to display
   * version information or validate notifier capabilities.
   */
  currentVersion?: string;
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
export type NotificationChannelSecureFields = Record<string, boolean | ''>;

export interface ChannelTypeSettings {
  [key: string]: any;
  autoResolve: true;
  httpMethod: string;
  severity: string;
  uploadImage: boolean;
}

export interface OptionMeta {
  required?: string | ValidationRule<boolean>;
  readOnly?: boolean;
}

export interface NotificationChannelOption {
  element:
    | 'input'
    | 'select'
    | 'checkbox'
    | 'radio'
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
  secureFieldKey?: string;
  /**
   * protected indicates that only administrators or users with
   * "alert.notifications.receivers.protected:write" permission
   * are allowed to update this field
   * */
  protected?: boolean;
  selectOptions?: Array<SelectableValue<string>> | null;
  defaultValue?: SelectableValue<string>;
  showWhen: { field: string; is: string | boolean };
  validationRule: string;
  subformOptions?: NotificationChannelOption[];
  dependsOn: string;
  setValueAs?: (value: string | boolean) => string | number | boolean | null;
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
