import { config } from '@grafana/runtime';
import { GrafanaAlertState } from 'app/types/unified-alerting-dto';

import { stableFromAlertRequest } from '../../api/assistantApi';

import {
  buildFromAlertRequest,
  getAlertInstanceStartsAtIso,
  getAssistantInvestigationUrl,
  isAssistantInvestigationActive,
  isAssistantInvestigationCompleted,
  isAssistantInvestigationFailed,
  isAssistantInvestigationTerminal,
} from './startInvestigationFromAlert';

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

describe('investigation state helpers', () => {
  describe('isAssistantInvestigationActive', () => {
    it.each(['pending', 'running', 'in_progress', 'in-progress', 'paused'])('treats %s as active', (state) => {
      expect(isAssistantInvestigationActive(state)).toBe(true);
    });

    it.each(['completed', 'failed', 'cancelled', 'canceled', undefined, ''])('treats %s as inactive', (state) => {
      expect(isAssistantInvestigationActive(state)).toBe(false);
    });
  });

  describe('isAssistantInvestigationCompleted', () => {
    it('is true only for completed', () => {
      expect(isAssistantInvestigationCompleted('completed')).toBe(true);
      expect(isAssistantInvestigationCompleted('in_progress')).toBe(false);
    });
  });

  describe('isAssistantInvestigationFailed', () => {
    it.each(['failed', 'cancelled', 'canceled'])('treats %s as failed', (state) => {
      expect(isAssistantInvestigationFailed(state)).toBe(true);
    });

    it('is false for other states', () => {
      expect(isAssistantInvestigationFailed('completed')).toBe(false);
      expect(isAssistantInvestigationFailed(undefined)).toBe(false);
    });
  });

  describe('isAssistantInvestigationTerminal', () => {
    it.each(['completed', 'failed', 'cancelled', 'canceled'])('treats %s as terminal', (state) => {
      expect(isAssistantInvestigationTerminal(state)).toBe(true);
    });

    it.each(['pending', 'in_progress', 'paused', 'weird-future-state', undefined, ''])(
      'treats %s as non-terminal',
      (state) => {
        expect(isAssistantInvestigationTerminal(state)).toBe(false);
      }
    );
  });

  describe('getAssistantInvestigationUrl', () => {
    it('builds a plugin bridge URL with an encoded investigation id', () => {
      expect(getAssistantInvestigationUrl('inv/123')).toBe('/a/grafana-assistant-app/investigations/inv%2F123');
    });
  });

  describe('getAlertInstanceStartsAtIso', () => {
    it('returns undefined when history is empty', () => {
      expect(getAlertInstanceStartsAtIso(undefined)).toBeUndefined();
      expect(getAlertInstanceStartsAtIso([])).toBeUndefined();
    });

    it('uses the most recent transition into Alerting', () => {
      const startsAt = getAlertInstanceStartsAtIso([
        { timestamp: 1_000, line: { previous: GrafanaAlertState.Normal, current: GrafanaAlertState.Alerting } },
        { timestamp: 5_000, line: { previous: GrafanaAlertState.Alerting, current: GrafanaAlertState.Normal } },
        { timestamp: 9_000, line: { previous: GrafanaAlertState.Normal, current: GrafanaAlertState.Alerting } },
      ]);

      expect(startsAt).toBe(new Date(9_000).toISOString());
    });

    it('returns undefined when history is clipped and never shows an enter-Alerting transition', () => {
      const startsAt = getAlertInstanceStartsAtIso([
        { timestamp: 4_000, line: { previous: GrafanaAlertState.Alerting, current: GrafanaAlertState.Alerting } },
        { timestamp: 2_000, line: { previous: GrafanaAlertState.Alerting, current: GrafanaAlertState.Alerting } },
      ]);

      expect(startsAt).toBeUndefined();
    });
  });
});
