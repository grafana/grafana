import { buildTestTemplateAlerts } from './buildTestTemplateAlerts';

describe('buildTestTemplateAlerts', () => {
  it('builds alertmanager-compatible alert payloads', () => {
    const alerts = buildTestTemplateAlerts({
      ruleName: 'High CPU',
      annotations: { summary: 'CPU is high', description: 'Investigate host-1' },
      labels: { severity: 'critical', instance: 'host-1' },
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      status: 'firing',
      labels: {
        alertname: 'High CPU',
        severity: 'critical',
        instance: 'host-1',
      },
      annotations: {
        summary: 'CPU is high',
        description: 'Investigate host-1',
      },
      fingerprint: 'notification-message-preview',
    });
    expect(alerts[0].startsAt).toBeTruthy();
    expect(alerts[0].endsAt).toBeTruthy();
  });

  it('merges evaluated rule preview instances with form annotations and labels', () => {
    const alerts = buildTestTemplateAlerts({
      ruleName: 'High CPU',
      annotations: { summary: 'CPU is high on host-1' },
      labels: { team: 'platform' },
      previewInstances: [
        {
          labels: { alertname: 'High CPU', instance: 'host-1', pod: 'api-1' },
          annotations: {
            summary: 'CPU is high on host-1',
            __value_string__: '[ var=A:labels={instance=host-1} value=92 ]',
          },
          startsAt: '2026-01-01T00:00:00.000Z',
          endsAt: '2026-01-01T01:00:00.000Z',
          generatorURL: 'http://grafana.local/alerting/grafana/abc/view',
        },
      ],
    });

    expect(alerts[0]).toMatchObject({
      labels: {
        alertname: 'High CPU',
        instance: 'host-1',
        pod: 'api-1',
        team: 'platform',
      },
      annotations: {
        summary: 'CPU is high on host-1',
        __value_string__: '[ var=A:labels={instance=host-1} value=92 ]',
      },
      generatorURL: 'http://grafana.local/alerting/grafana/abc/view',
    });
  });

  it('uses a fallback alert name when the rule is untitled', () => {
    const alerts = buildTestTemplateAlerts({
      ruleName: '   ',
      annotations: {},
      labels: {},
    });

    expect(alerts[0].labels.alertname).toBe('Untitled alert');
  });
});
