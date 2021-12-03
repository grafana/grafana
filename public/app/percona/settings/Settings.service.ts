import { AppEvents } from '@grafana/data';
import { logger } from '@percona/platform-core';
import { appEvents } from 'app/core/app_events';
import { CancelToken } from 'axios';
import { api } from 'app/percona/shared/helpers/api';
import { Messages } from './Settings.messages';
import { Settings, SettingsAPIChangePayload, SettingsAPIResponse, SettingsPayload } from './Settings.types';

export type LoadingCallback = (value: boolean) => void;
export type SettingsCallback = (settings: Settings) => void;

export const SettingsService = {
  async getSettings(token?: CancelToken, disableNotifications = false): Promise<Settings> {
    const { settings }: SettingsAPIResponse = await api.post('/v1/Settings/Get', {}, disableNotifications, token);
    return toModel(settings);
  },
  async setSettings(
    body: SettingsAPIChangePayload,
    setLoading: LoadingCallback,
    token?: CancelToken
  ): Promise<Settings | undefined> {
    let response;
    try {
      setLoading(true);
      const { settings }: SettingsAPIResponse = await api.post<any, any>('/v1/Settings/Change', body, false, token);
      response = toModel(settings);
      appEvents.emit(AppEvents.alertSuccess, [Messages.service.success]);
    } catch (e) {
      logger.error(e);
    } finally {
      setLoading(false);
    }

    return response;
  },
};

const toModel = (response: SettingsPayload): Settings => ({
  awsPartitions: response.aws_partitions,
  updatesDisabled: response.updates_disabled,
  telemetryEnabled: response.telemetry_enabled,
  metricsResolutions: response.metrics_resolutions,
  dataRetention: response.data_retention,
  sshKey: response.ssh_key,
  alertManagerUrl: response.alert_manager_url,
  alertManagerRules: response.alert_manager_rules,
  sttEnabled: response.stt_enabled,
  platformEmail: response.platform_email,
  azureDiscoverEnabled: response.azurediscover_enabled,
  dbaasEnabled: response.dbaas_enabled,
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
});
