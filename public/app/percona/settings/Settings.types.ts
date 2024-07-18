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

export enum AdvisorRunIntervals {
  rareInterval = 'rareInterval',
  standardInterval = 'standardInterval',
  frequentInterval = 'frequentInterval',
}

export interface AdvisorRunIntervalsSettings {
  [AdvisorRunIntervals.rareInterval]: string;
  [AdvisorRunIntervals.standardInterval]: string;
  [AdvisorRunIntervals.frequentInterval]: string;
}

export interface AdvisorRunIntervalsPayload {
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
  enable_alerting?: boolean;
  enable_advisor: boolean;
  advisor_run_intervals?: AdvisorRunIntervalsPayload;
  enable_backup_management: boolean;
  enable_azurediscover?: boolean;
  enable_updates?: boolean;
  enable_access_control?: boolean;
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
  aws_partitions: {
    values: string[];
  };
  platform_email: string;
  enable_updates: boolean;
  telemetry_enabled: boolean;
  advisor_enabled: boolean;
  alerting_enabled: boolean;
  backup_management_enabled: boolean;
  azurediscover_enabled: boolean;
  advisor_run_intervals: AdvisorRunIntervalsPayload;
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
  advisorEnabled: boolean;
  backupEnabled: boolean;
  alertingEnabled: boolean;
  updatesEnabled: boolean;
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
  advisorRunIntervals: AdvisorRunIntervalsSettings;
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
