import { CancelToken } from 'axios';

import { api } from 'app/percona/shared/helpers/api';
import { logger } from 'app/percona/shared/helpers/logger';

import { Settings, SettingsAPIChangePayload, SettingsAPIResponse, SettingsPayload } from './Settings.types';

export type LoadingCallback = (value: boolean) => void;
export type SettingsCallback = (settings: Settings) => void;

export const SettingsService = {
  async getSettings(token?: CancelToken, disableNotifications = false): Promise<Settings> {
    const { settings }: SettingsAPIResponse = await api.post('/v1/Settings/Get', {}, disableNotifications, token);
    return toModel(settings);
  },
  async setSettings(body: Partial<SettingsAPIChangePayload>, token?: CancelToken): Promise<Settings | undefined> {
    let response;
    try {
      const { settings } = await api.post<SettingsAPIResponse, Partial<SettingsAPIChangePayload>>(
        '/v1/Settings/Change',
        body,
        false,
        token
      );
      response = toModel(settings);
    } catch (e) {
      logger.error(e);
    }

    return response;
  },
};

const toModel = (response: SettingsPayload): Settings => ({
  awsPartitions: response.aws_partitions,
  updatesDisabled: response.updates_disabled,
  telemetryEnabled: response.telemetry_enabled,
  telemetrySummaries: response.telemetry_summaries || [],
  metricsResolutions: response.metrics_resolutions,
  dataRetention: response.data_retention,
  sshKey: response.ssh_key,
  alertManagerUrl: response.alert_manager_url,
  alertManagerRules: response.alert_manager_rules,
  sttEnabled: response.stt_enabled,
  platformEmail: response.platform_email,
  azureDiscoverEnabled: response.azurediscover_enabled,
  alertingEnabled: response.alerting_enabled,
  alertingSettings: {
    email: response.email_alerting_settings || {},
    slack: response.slack_alerting_settings || {},
  },
  publicAddress: response.pmm_public_address,
  sttCheckIntervals: {
    rareInterval: response.stt_check_intervals.rare_interval,
    standardInterval: response.stt_check_intervals.standard_interval,
    frequentInterval: response.stt_check_intervals.frequent_interval,
  },
  backupEnabled: response.backup_management_enabled,
  isConnectedToPortal: response.connected_to_platform,
  defaultRoleId: response.default_role_id,
  enableAccessControl: response.enable_access_control,
});
