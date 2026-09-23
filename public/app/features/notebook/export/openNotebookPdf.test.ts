import { type GrafanaConfig, locationUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { canExportNotebookPdf, navigateToNotebookPdf, openBlankNotebookPdfTab } from './openNotebookPdf';

const TIME_RANGE = { from: 'now-6h', to: 'now', timezone: 'America/New_York' };

describe('openBlankNotebookPdfTab', () => {
  const originalOpen = window.open;

  afterEach(() => {
    window.open = originalOpen;
  });

  it('opens a blank tab, without noopener/noreferrer', () => {
    window.open = jest.fn().mockReturnValue({});

    openBlankNotebookPdfTab();

    // No third argument: noopener/noreferrer make window.open return null unconditionally, which
    // would make every export — successful or not — look like it was popup-blocked.
    expect(window.open).toHaveBeenCalledWith('', '_blank');
  });

  it('returns the tab reference when it actually opened', () => {
    const tab = {};
    window.open = jest.fn().mockReturnValue(tab);

    expect(openBlankNotebookPdfTab()).toBe(tab);
  });

  // window.open returns null rather than throwing when a popup blocker eats it.
  it('returns null when a popup blocker silently ate the tab', () => {
    window.open = jest.fn().mockReturnValue(null);

    expect(openBlankNotebookPdfTab()).toBeNull();
  });
});

describe('canExportNotebookPdf', () => {
  const originalAvailable = config.rendererAvailable;
  const originalVersion = config.rendererVersion;

  afterEach(() => {
    config.rendererAvailable = originalAvailable;
    config.rendererVersion = originalVersion;
  });

  it('says no when no renderer is configured at all', () => {
    config.rendererAvailable = false;
    config.rendererVersion = '3.11.0';

    expect(canExportNotebookPdf()).toBe(false);
  });

  // The backend rejects encoding=pdf below this version, so offering the action would only ever
  // produce a render error.
  it.each([
    ['3.9.0', false],
    ['3.10.0', true],
    ['3.11.2', true],
    ['4.0.0', true],
  ])('reads renderer version %s as PDF-capable: %s', (version, expected) => {
    config.rendererAvailable = true;
    config.rendererVersion = version;

    expect(canExportNotebookPdf()).toBe(expected);
  });

  // Same leniency as the backend's own semver parse.
  it.each(['v3.10.0', '3.10'])('accepts the loosely written version %s', (version) => {
    config.rendererAvailable = true;
    config.rendererVersion = version;

    expect(canExportNotebookPdf()).toBe(true);
  });

  // Grafana fetches the version from the renderer asynchronously and retries, so an available
  // renderer can still report no version. Fails closed, like the backend does.
  it.each(['', 'not-a-version'])('says no for the unreadable version "%s"', (version) => {
    config.rendererAvailable = true;
    config.rendererVersion = version;

    expect(canExportNotebookPdf()).toBe(false);
  });
});

describe('navigateToNotebookPdf', () => {
  const originalOrgId = contextSrv.user.orgId;
  const originalIntl = window.Intl;

  beforeEach(() => {
    contextSrv.user.orgId = 7;
  });

  afterEach(() => {
    contextSrv.user.orgId = originalOrgId;
    Object.defineProperty(window, 'Intl', { value: originalIntl, configurable: true, writable: true });
    // locationUtil holds the sub-path in module state, so the one test that sets it has to hand
    // the rest of the file back a Grafana served from the root.
    locationUtil.initialize({
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only appSubUrl is read
      config: { appSubUrl: '' } as GrafanaConfig,
      getVariablesUrlParams: jest.fn(),
      getTimeRangeForUrl: jest.fn(),
    });
  });

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only .href is read
  function fakeTab() {
    return { location: { href: '' } } as unknown as Window;
  }

  it('navigates the tab to the notebook PDF render url', () => {
    const tab = fakeTab();

    navigateToNotebookPdf(tab, 'nb1', TIME_RANGE);

    // The notebook's own chromeless render route, not the page a reader opens.
    expect(tab.location.href).toMatch(/^\/render\/notebooks\/nb1\/render\?/);
    // For the transport, to pick a PDF over a PNG.
    expect(tab.location.href).toContain('encoding=pdf');
    expect(tab.location.href).toContain('orgId=7');
    // The route is chromeless and the page leaves out its own chrome, so nothing has to ask for
    // either — these were needed only while this pointed at the ordinary notebook page.
    expect(tab.location.href).not.toContain('kiosk');
    expect(tab.location.href).not.toContain('hideNav');
    expect(tab.location.href).not.toContain('pdfLayout');
  });

  // The tab being navigated is `about:blank` and carries no `<base href>` of its own, so the
  // sub-path is spelled out rather than left to whatever base url a browser resolves against.
  it('spells out the sub-path Grafana is served under', () => {
    locationUtil.initialize({
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only appSubUrl is read
      config: { appSubUrl: '/grafana' } as GrafanaConfig,
      getVariablesUrlParams: jest.fn(),
      getTimeRangeForUrl: jest.fn(),
    });
    const tab = fakeTab();

    navigateToNotebookPdf(tab, 'nb1', TIME_RANGE);

    expect(tab.location.href).toMatch(/^\/grafana\/render\/notebooks\/nb1\/render\?/);
  });

  it('carries the current time range, so the render reflects what is on screen rather than the saved range', () => {
    const tab = fakeTab();

    navigateToNotebookPdf(tab, 'nb1', TIME_RANGE);

    expect(tab.location.href).toContain('from=now-6h');
    expect(tab.location.href).toContain('to=now');
  });

  it('omits timezone params when no timezone is given, rather than sending an empty value', () => {
    const tab = fakeTab();

    navigateToNotebookPdf(tab, 'nb1', { from: 'now-6h', to: 'now' });

    expect(tab.location.href).not.toContain('timezone=');
    expect(tab.location.href).not.toContain('tz=');
  });

  it('passes an explicit IANA zone straight through, under both timezone and tz', () => {
    const tab = fakeTab();

    navigateToNotebookPdf(tab, 'nb1', TIME_RANGE);

    expect(tab.location.href).toContain(`timezone=${encodeURIComponent('America/New_York')}`);
    expect(tab.location.href).toContain(`tz=${encodeURIComponent('America/New_York')}`);
  });

  it("resolves 'utc' to 'UTC'", () => {
    const tab = fakeTab();

    navigateToNotebookPdf(tab, 'nb1', { from: 'now-6h', to: 'now', timezone: 'utc' });

    expect(tab.location.href).toContain('timezone=UTC');
    expect(tab.location.href).toContain('tz=UTC');
  });

  // A headless renderer has no reader behind it for 'browser' to mean anything to, so it has to
  // resolve to a concrete zone before either the scene or the renderer's own OS timezone see it.
  it("resolves 'browser' to the current Intl-reported timezone", () => {
    Object.defineProperty(window, 'Intl', {
      value: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: 'Europe/Berlin' }) }) },
      configurable: true,
      writable: true,
    });
    const tab = fakeTab();

    navigateToNotebookPdf(tab, 'nb1', { from: 'now-6h', to: 'now', timezone: 'browser' });

    expect(tab.location.href).toContain(`timezone=${encodeURIComponent('Europe/Berlin')}`);
    expect(tab.location.href).toContain(`tz=${encodeURIComponent('Europe/Berlin')}`);
  });

  it("falls back to a UTC offset when 'browser' can't be resolved via Intl", () => {
    Object.defineProperty(window, 'Intl', { value: undefined, configurable: true, writable: true });
    const tab = fakeTab();

    navigateToNotebookPdf(tab, 'nb1', { from: 'now-6h', to: 'now', timezone: 'browser' });

    expect(tab.location.href).toMatch(/timezone=UTC/);
  });
});
