import { getIntegrationPreviewTemplates } from './getIntegrationPreviewTemplates';

describe('getIntegrationPreviewTemplates', () => {
  it('uses slack defaults when settings are empty', () => {
    const templates = getIntegrationPreviewTemplates({
      type: 'slack',
      settings: {},
    });

    expect(templates.integrationType).toBe('slack');
    expect(templates.titleTemplate).toContain('slack.default.title');
    expect(templates.bodyTemplate).toContain('slack.default.text');
  });

  it('uses configured slack templates when provided', () => {
    const templates = getIntegrationPreviewTemplates({
      type: 'slack',
      settings: {
        title: 'CPU high on {{ $labels.instance }}',
        text: 'Check the deployment',
      },
    });

    expect(templates.titleTemplate).toBe('CPU high on {{ $labels.instance }}');
    expect(templates.bodyTemplate).toBe('Check the deployment');
  });

  it('uses email subject and message fields', () => {
    const templates = getIntegrationPreviewTemplates({
      type: 'email',
      settings: {
        subject: 'Alert: {{ .CommonLabels.alertname }}',
        message: 'Please investigate',
      },
    });

    expect(templates.titleTemplate).toBe('Alert: {{ .CommonLabels.alertname }}');
    expect(templates.bodyTemplate).toBe('Please investigate');
    expect(templates.previewMayDifferFromDelivery).toBe(false);
  });

  it('flags Grafana IRM as an approximate preview', () => {
    const templates = getIntegrationPreviewTemplates({
      type: 'oncall',
      settings: {
        url: 'https://irm.example.com',
      },
    });

    expect(templates.integrationLabel).toBe('Grafana IRM');
    expect(templates.previewMayDifferFromDelivery).toBe(true);
  });
});
