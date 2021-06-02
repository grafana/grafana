import * as settingsService from '../Settings.service';

export const SettingsService = jest.genMockFromModule<typeof settingsService>('../Settings.service').SettingsService;

SettingsService.getSettings = () =>
  Promise.resolve({
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
      },
      slack: {
        url: 'slack.foo.com',
      },
    },
  });
