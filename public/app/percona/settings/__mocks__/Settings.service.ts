import * as settingsService from '../Settings.service';
import { Settings } from '../Settings.types';

export const SettingsService = jest.genMockFromModule<typeof settingsService>('../Settings.service').SettingsService;
export const stub: Settings = {
  updatesDisabled: true,
  telemetryEnabled: true,
  backupEnabled: false,
  metricsResolutions: {
    lr: '10s',
    hr: '15s',
    mr: '20s',
  },
  dataRetention: '',
  sshKey: 'key',
  awsPartitions: [],
  alertManagerUrl: 'alert.foo.com',
  alertManagerRules: '',
  sttEnabled: true,
  alertingEnabled: true,
  alertingSettings: {
    email: {
      from: 'from',
      smarthost: 'host',
      hello: 'hello',
      require_tls: false,
    },
    slack: {
      url: 'slack.foo.com',
    },
  },
  sttCheckIntervals: {
    rareInterval: '10s',
    standardInterval: '10s',
    frequentInterval: '10s',
  },
};

SettingsService.getSettings = () => Promise.resolve(stub);
