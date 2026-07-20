import { config } from '@grafana/runtime';

import { buildFromAlertRequest, stableFromAlertRequest } from './StartInvestigationButton';

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
    });

    expect(body.groupLabels).toEqual({ alertname: 'HighCPU', instance: 'a' });
    expect(body.name).toBeUndefined();
    expect(body.alerts[0].status).toBeUndefined();
    expect(body.alerts[0].startsAt).toBeUndefined();
    expect(body.alerts[0].generatorURL).toBeUndefined();
    expect(body.externalURL).toBe('https://grafana.example');
  });

  it('includes appSubUrl in externalURL', () => {
    config.appUrl = 'https://grafana.example/grafana/';
    config.appSubUrl = '/grafana';

    const body = buildFromAlertRequest({
      instanceLabels: { alertname: 'HighCPU' },
      rule: { uid: 'rule-1', title: 'High CPU', namespace_uid: 'ns', rule_group: 'g', data: [], condition: 'A' },
    });

    expect(body.externalURL).toBe('https://grafana.example/grafana');
  });

  it('falls back to rule identity when the instance has no labels', () => {
    const body = buildFromAlertRequest({
      instanceLabels: {},
      rule: { uid: 'rule-1', title: 'High CPU', namespace_uid: 'ns', rule_group: 'g', data: [], condition: 'A' },
    });

    expect(body.groupLabels).toEqual({ alertname: 'High CPU', rule_uid: 'rule-1' });
  });

  it('keeps the same identity before and after the rule loads when labels exist', () => {
    const withoutRule = buildFromAlertRequest({
      instanceLabels: { alertname: 'HighCPU', instance: 'a' },
    });
    const withRule = buildFromAlertRequest({
      instanceLabels: { alertname: 'HighCPU', instance: 'a' },
      rule: { uid: 'rule-1', title: 'High CPU', namespace_uid: 'ns', rule_group: 'g', data: [], condition: 'A' },
    });

    expect(withoutRule).toEqual(withRule);
  });
});

describe('stableFromAlertRequest', () => {
  it('strips startsAt, status, name, and generatorURL so rule load does not change identity', () => {
    const beforeRule = stableFromAlertRequest({
      alerts: [{ labels: { alertname: 'HighCPU' } }],
      groupLabels: { alertname: 'HighCPU' },
    });
    const afterStart = stableFromAlertRequest({
      name: 'High CPU',
      alerts: [
        {
          labels: { alertname: 'HighCPU' },
          status: 'firing',
          startsAt: '2026-01-01T00:00:00Z',
          generatorURL: 'https://grafana.example/alerting/grafana/rule-1/view',
        },
      ],
      groupLabels: { alertname: 'HighCPU' },
    });

    expect(beforeRule).toEqual(afterStart);
    expect(afterStart.name).toBeUndefined();
    expect(afterStart.alerts[0].status).toBeUndefined();
    expect(afterStart.alerts[0].startsAt).toBeUndefined();
    expect(afterStart.alerts[0].generatorURL).toBeUndefined();
  });
});
