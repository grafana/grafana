import { contextSrv } from 'app/core/services/context_srv';

import { getTelemetrySetupCta, getTelemetrySetupLearnMore, getTelemetrySetupLink } from './telemetrySetup';

const originalIsGrafanaAdmin = contextSrv.isGrafanaAdmin;

beforeEach(() => {
  contextSrv.isGrafanaAdmin = false;
  jest.spyOn(contextSrv, 'hasRole').mockReturnValue(false);
});

afterEach(() => {
  contextSrv.isGrafanaAdmin = originalIsGrafanaAdmin;
  jest.restoreAllMocks();
});

describe('getTelemetrySetupLink', () => {
  it.each([
    ['metrics', 'Connect metrics', '/a/grafana-setupguide-app/getting-started/prometheus'],
    ['logs', 'Add logs', '/a/grafana-setupguide-app/getting-started/logs-onboarding'],
  ] as const)('prefers the guided %s onboarding flow', (type, action, href) => {
    jest.mocked(contextSrv.hasRole).mockImplementation((role) => role === 'Admin');

    expect(getTelemetrySetupLink(type, { setupGuideEnabled: true })).toEqual({ action, href, cta: 'setup' });
  });

  it.each([
    ['metrics', 'Connect metrics', 'https://grafana.com/docs/grafana/latest/datasources/prometheus/configure/'],
    ['logs', 'Add logs', 'https://grafana.com/docs/loki/latest/send-data/'],
    ['traces', 'Instrument traces', 'https://grafana.com/docs/tempo/latest/set-up-for-tracing/'],
  ] as const)('falls back to public %s setup documentation', (type, action, href) => {
    expect(getTelemetrySetupLink(type, { setupGuideEnabled: false })).toEqual({ action, href, cta: 'learn_more' });
  });

  it('uses public documentation when the setup guide is not accessible to the user', () => {
    expect(getTelemetrySetupLink('logs', { setupGuideEnabled: true })).toEqual({
      action: 'Add logs',
      href: 'https://grafana.com/docs/grafana-cloud/send-data/logs/',
      cta: 'learn_more',
    });
  });

  it('uses Cloud instrumentation documentation for traces even when the setup guide is available', () => {
    jest.mocked(contextSrv.hasRole).mockImplementation((role) => role === 'Admin');

    expect(getTelemetrySetupLink('traces', { setupGuideEnabled: true })).toEqual({
      action: 'Instrument traces',
      href: 'https://grafana.com/docs/grafana-cloud/send-data/traces/set-up/instrument-apps/',
      cta: 'learn_more',
    });
  });
});

describe('getTelemetrySetupCta', () => {
  it('keeps the in-app guide an in-product CTA', () => {
    jest.mocked(contextSrv.hasRole).mockImplementation((role) => role === 'Admin');

    expect(getTelemetrySetupCta('metrics', { setupGuideEnabled: true })).toEqual({
      label: 'Connect metrics',
      href: '/a/grafana-setupguide-app/getting-started/prometheus',
      action: 'setup',
    });
  });

  it('omits the CTA when no in-app guide is available', () => {
    expect(getTelemetrySetupCta('metrics', { setupGuideEnabled: false })).toBeNull();
    expect(getTelemetrySetupCta('traces', { setupGuideEnabled: true })).toBeNull();
  });
});

describe('getTelemetrySetupLearnMore', () => {
  it('selects deployment-appropriate documentation independently of the CTA', () => {
    expect(getTelemetrySetupLearnMore('metrics', { setupGuideEnabled: false })).toEqual({
      href: 'https://grafana.com/docs/grafana/latest/datasources/prometheus/configure/',
    });
    expect(getTelemetrySetupLearnMore('metrics', { setupGuideEnabled: true })).toEqual({
      href: 'https://grafana.com/docs/grafana-cloud/send-data/metrics/',
    });
  });
});
