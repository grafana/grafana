export interface EmailSettings {
  from: string;
  smarthost: string;
  hello: string;
  username?: string;
  password?: string;
  secret?: string;
  identity?: string;
  require_tls?: boolean;
  test_email?: string;
}

export interface SlackSettings {
  url?: string;
}

export interface AlertingSettings {
  email: EmailSettings;
  slack: SlackSettings;
}

export enum SttCheckIntervals {
  rareInterval = 'rareInterval',
  standardInterval = 'standardInterval',
  frequentInterval = 'frequentInterval',
}

export interface SttCheckIntervalsSettings {
  [SttCheckIntervals.rareInterval]: string;
  [SttCheckIntervals.standardInterval]: string;
  [SttCheckIntervals.frequentInterval]: string;
}

export interface SttCheckIntervalsPayload {
  rare_interval: string;
  standard_interval: string;
  frequent_interval: string;
}

export interface AlertManagerPayload {
  alert_manager_url: string;
  alert_manager_rules: string;
}

export interface AlertManagerChangePayload extends AlertManagerPayload {
  alert_manager_url: string;
  alert_manager_rules: string;
  remove_alert_manager_url?: boolean;
  remove_alert_manager_rules?: boolean;
}

export interface AdvancedPayload {
  data_retention: string;
  pmm_public_address?: string;
}

export interface AdvancedChangePayload extends AdvancedPayload {
  enable_telemetry: boolean;
  disable_telemetry: boolean;
  enable_stt: boolean;
  disable_stt: boolean;
  remove_pmm_public_address: boolean;
  enable_alerting?: boolean;
  disable_alerting?: boolean;
  enable_backup_management: boolean;
  disable_backup_management: boolean;
  disable_azurediscover?: boolean;
  enable_azurediscover?: boolean;
  stt_check_intervals?: SttCheckIntervalsPayload;
  enable_updates?: boolean;
  disable_updates?: boolean;
  enable_access_control?: boolean;
  disable_access_control?: boolean;
}

export interface MetricsResolutionsPayload {
  metrics_resolutions: MetricsResolutions;
}

export interface EmailPayload {
  email_alerting_settings: EmailSettings;
}

export interface SlackPayload {
  slack_alerting_settings: SlackSettings;
}

export interface SSHPayload {
  ssh_key: string;
}

export interface SettingsAPIResponse {
  settings: SettingsPayload;
}

export interface SettingsPayload
  extends AlertManagerPayload,
    AdvancedPayload,
    MetricsResolutionsPayload,
    EmailPayload,
    SlackPayload,
    SSHPayload {
  aws_partitions: string[];
  platform_email: string;
  updates_disabled: boolean;
  telemetry_enabled: boolean;
  stt_enabled: boolean;
  alerting_enabled: boolean;
  backup_management_enabled: boolean;
  azurediscover_enabled: boolean;
  stt_check_intervals: SttCheckIntervalsPayload;
  connected_to_platform: boolean;
  telemetry_summaries: string[];
  default_role_id: number;
  enable_access_control: boolean;
}

export type SettingsAPIChangePayload =
  | AlertManagerChangePayload
  | AdvancedChangePayload
  | MetricsResolutionsPayload
  | EmailPayload
  | SlackPayload
  | SSHPayload;

export interface Settings {
  sttEnabled: boolean;
  backupEnabled: boolean;
  alertingEnabled: boolean;
  updatesDisabled: boolean;
  telemetryEnabled: boolean;
  metricsResolutions: MetricsResolutions;
  dataRetention: string;
  sshKey: string;
  awsPartitions: string[];
  alertManagerUrl: string;
  alertManagerRules: string;
  azureDiscoverEnabled?: boolean;
  platformEmail?: string;
  publicAddress?: string;
  alertingSettings: AlertingSettings;
  sttCheckIntervals: SttCheckIntervalsSettings;
  isConnectedToPortal?: boolean;
  telemetrySummaries: string[];
  defaultRoleId: number;
  enableAccessControl: boolean;
}

export interface MetricsResolutions {
  hr: string;
  mr: string;
  lr: string;
}

export enum EmailAuthType {
  NONE = 'NONE',
  PLAIN = 'PLAIN',
  LOGIN = 'LOGIN',
  CRAM = 'CRAM-MD5',
}
