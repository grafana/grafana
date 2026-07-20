import { config } from '@grafana/runtime';
import { GrafanaAlertState } from 'app/types/unified-alerting-dto';

import { buildFromAlertRequest } from './StartInvestigationButton';

describe('buildFromAlertRequest', () => {
  const originalAppUrl = config.appUrl;
  const originalAppSubUrl = config.appSubUrl;

  beforeEach(() => {
    config.appUrl = 'https://grafana.example/';
    config.appSubUrl = '';
  });

  afterAll(() => {
    config.appUrl = originalAppUrl;
    config.appSubUrl = originalAppSubUrl;
  });

  it('uses instance labels as groupLabels when present', () => {
    const body = buildFromAlertRequest({
      instanceLabels: { alertname: 'HighCPU', instance: 'a' },
      rule: { uid: 'rule-1', title: 'High CPU', namespace_uid: 'ns', rule_group: 'g', data: [], condition: 'A' },
      alertState: GrafanaAlertState.Alerting,
    });

    expect(body.groupLabels).toEqual({ alertname: 'HighCPU', instance: 'a' });
    expect(body.alerts[0].status).toBe('firing');
    expect(body.alerts[0].startsAt).toBeUndefined();
    expect(body.alerts[0].generatorURL).toBe('https://grafana.example/alerting/grafana/rule-1/view');
    expect(body.externalURL).toBe('https://grafana.example');
  });

  it('includes appSubUrl in generatorURL and externalURL', () => {
    config.appUrl = 'https://grafana.example/grafana/';
    config.appSubUrl = '/grafana';

    const body = buildFromAlertRequest({
      instanceLabels: { alertname: 'HighCPU' },
      rule: { uid: 'rule-1', title: 'High CPU', namespace_uid: 'ns', rule_group: 'g', data: [], condition: 'A' },
    });

    expect(body.alerts[0].generatorURL).toBe('https://grafana.example/grafana/alerting/grafana/rule-1/view');
    expect(body.externalURL).toBe('https://grafana.example/grafana');
  });

  it('falls back to rule identity when the instance has no labels', () => {
    const body = buildFromAlertRequest({
      instanceLabels: {},
      rule: { uid: 'rule-1', title: 'High CPU', namespace_uid: 'ns', rule_group: 'g', data: [], condition: 'A' },
    });

    expect(body.groupLabels).toEqual({ alertname: 'High CPU', rule_uid: 'rule-1' });
  });

  it('marks resolved alerts when state is Normal', () => {
    const body = buildFromAlertRequest({
      instanceLabels: { alertname: 'HighCPU' },
      alertState: GrafanaAlertState.Normal,
    });

    expect(body.alerts[0].status).toBe('resolved');
  });
});
