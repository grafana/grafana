import { type GrafanaConfig, locationUtil } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';

import { resolveCtaUrl } from './SplashScreenModal';
import { type SplashFeatureCta } from './splashContent';

function initLocationUtil(appSubUrl: string) {
  locationUtil.initialize({
    config: { appSubUrl } as GrafanaConfig,
    getTimeRangeForUrl: jest.fn(),
    getVariablesUrlParams: jest.fn(),
  });
}

describe('resolveCtaUrl', () => {
  beforeEach(() => {
    jest.spyOn(contextSrv, 'hasRole').mockReturnValue(true);
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    initLocationUtil('');
  });

  it('prepends appSubUrl to internal paths when Grafana is served from a sub-path', () => {
    initLocationUtil('/grafana');
    const cta: SplashFeatureCta = { text: 'Show me', url: '/plugins/grafana-assistant-app/' };

    expect(resolveCtaUrl(cta)).toBe('/grafana/plugins/grafana-assistant-app/');
  });

  it('returns internal paths unchanged when no sub-path is configured', () => {
    initLocationUtil('');
    const cta: SplashFeatureCta = { text: 'Show me', url: '/dashboard/new' };

    expect(resolveCtaUrl(cta)).toBe('/dashboard/new');
  });

  it('does not modify external https URLs', () => {
    initLocationUtil('/grafana');
    const cta: SplashFeatureCta = { text: 'Docs', url: 'https://grafana.com/docs/' };

    expect(resolveCtaUrl(cta)).toBe('https://grafana.com/docs/');
  });

  it('falls back to fallbackUrl when admin requirement is not met, and prepends appSubUrl if fallback is internal', () => {
    initLocationUtil('/grafana');
    jest.spyOn(contextSrv, 'hasRole').mockReturnValue(false);
    const cta: SplashFeatureCta = {
      text: 'Show me',
      url: '/admin/provisioning',
      fallbackUrl: '/docs/inline',
      requiresAdmin: true,
    };

    expect(resolveCtaUrl(cta)).toBe('/grafana/docs/inline');
  });

  it('falls back to external fallbackUrl when permission requirement is not met, leaving it unchanged', () => {
    initLocationUtil('/grafana');
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    const cta: SplashFeatureCta = {
      text: 'Show me',
      url: '/dashboard/new',
      fallbackUrl: 'https://grafana.com/docs/',
      permission: 'dashboards:create',
    };

    expect(resolveCtaUrl(cta)).toBe('https://grafana.com/docs/');
  });
});
