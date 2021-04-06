import { AppEvents } from '@grafana/data';
import { logger } from '@percona/platform-core';
import { appEvents } from 'app/core/app_events';
import { api } from 'app/percona/shared/helpers/api';
import { Messages } from './Settings.messages';
import { Settings, SettingsAPIChangePayload, SettingsPayload } from './Settings.types';

export type LoadingCallback = (value: boolean) => void;
export type SettingsCallback = (settings: Settings) => void;

export const SettingsService = {
  async getSettings(setLoading: LoadingCallback, setSettings: SettingsCallback) {
    let response: any;

    try {
      setLoading(true);
      response = await api.post<any, any>('/v1/Settings/Get', {});

      setSettings(toModel(response.settings));
    } catch (e) {
      logger.error(e);
    } finally {
      setLoading(false);
    }

    return response;
  },
  async setSettings(body: SettingsAPIChangePayload, setLoading: LoadingCallback) {
    let response: Settings = {
      awsPartitions: [],
      updatesDisabled: false,
      telemetryEnabled: false,
      metricsResolutions: {
        hr: '',
        mr: '',
        lr: '',
      },
      dataRetention: '',
      sshKey: '',
      alertManagerUrl: '',
      alertManagerRules: '',
      sttEnabled: false,
      alertingSettings: {
        email: {
          from: '',
          smarthost: '',
          hello: '',
        },
        slack: {
          url: '',
        },
      },
    };

    try {
      setLoading(true);
      const { settings }: { settings: SettingsPayload } = await api.post<any, any>('/v1/Settings/Change', body);
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
});
