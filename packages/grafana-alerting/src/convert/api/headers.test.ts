import { getConvertAlertmanagerHeaders, getConvertRulesHeaders } from './headers';

describe('getConvertRulesHeaders', () => {
  it('sends no headers when no options are set', () => {
    expect(getConvertRulesHeaders({})).toEqual({});
  });

  it('sends every option as its header', () => {
    expect(
      getConvertRulesHeaders({
        datasourceUid: 'mimir',
        targetDatasourceUid: 'mimir-writes',
        folderUid: 'folder-1',
        recordingRulesPaused: false,
        alertRulesPaused: true,
        notificationSettings: { type: 'SimplifiedRouting', receiver: 'oncall', groupBy: ['alertname'] },
        extraLabels: { team: 'alerting', env: 'prod' },
        versionMessage: 'Imported from Mimir',
        disableProvenance: true,
      })
    ).toEqual({
      'X-Grafana-Alerting-Datasource-UID': 'mimir',
      'X-Grafana-Alerting-Target-Datasource-UID': 'mimir-writes',
      'X-Grafana-Alerting-Folder-UID': 'folder-1',
      'X-Grafana-Alerting-Recording-Rules-Paused': 'false',
      'X-Grafana-Alerting-Alert-Rules-Paused': 'true',
      'X-Grafana-Alerting-Notification-Settings': JSON.stringify({ receiver: 'oncall', group_by: ['alertname'] }),
      'X-Grafana-Alerting-Extra-Labels': 'team=alerting,env=prod',
      'X-Grafana-Alerting-Version-Message': 'Imported from Mimir',
      'X-Disable-Provenance': 'true',
    });
  });

  it('leaves out the notification settings header for default routing', () => {
    expect(getConvertRulesHeaders({ notificationSettings: null })).not.toHaveProperty(
      'X-Grafana-Alerting-Notification-Settings'
    );
  });
});

describe('getConvertAlertmanagerHeaders', () => {
  it('always sends the identifier, and the flags only when set', () => {
    expect(getConvertAlertmanagerHeaders({ identifier: 'prometheus-prod' })).toEqual({
      'X-Grafana-Alerting-Config-Identifier': 'prometheus-prod',
    });

    expect(
      getConvertAlertmanagerHeaders({ identifier: 'prometheus-prod', forceReplace: true, dryRun: true, promote: true })
    ).toEqual({
      'X-Grafana-Alerting-Config-Identifier': 'prometheus-prod',
      'X-Grafana-Alerting-Config-Force-Replace': 'true',
      'X-Grafana-Alerting-Dry-Run': 'true',
      'X-Grafana-Alerting-Promote': 'true',
    });
  });
});
