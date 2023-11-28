export const SettingsService = jest.genMockFromModule('../Settings.service').SettingsService;
export const stub = {
    updatesDisabled: true,
    telemetryEnabled: true,
    backupEnabled: false,
    dbaasEnabled: false,
    enableAccessControl: false,
    metricsResolutions: {
        lr: '10s',
        hr: '15s',
        mr: '20s',
    },
    telemetrySummaries: [],
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
    defaultRoleId: 1,
};
SettingsService.getSettings = () => Promise.resolve(stub);
SettingsService.setSettings = (body) => Promise.resolve(Object.assign(Object.assign({}, stub), body));
//# sourceMappingURL=Settings.service.js.map