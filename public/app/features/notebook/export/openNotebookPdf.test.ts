import { contextSrv } from 'app/core/services/context_srv';

import { navigateToNotebookPdf, openBlankNotebookPdfTab } from './openNotebookPdf';

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

describe('navigateToNotebookPdf', () => {
  const originalOrgId = contextSrv.user.orgId;
  const originalIntl = window.Intl;

  beforeEach(() => {
    contextSrv.user.orgId = 7;
  });

  afterEach(() => {
    contextSrv.user.orgId = originalOrgId;
    Object.defineProperty(window, 'Intl', { value: originalIntl, configurable: true, writable: true });
  });

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only .href is read
  function fakeTab() {
    return { location: { href: '' } } as unknown as Window;
  }

  it('navigates the tab to the notebook PDF render url', () => {
    const tab = fakeTab();

    navigateToNotebookPdf(tab, 'nb1', TIME_RANGE);

    expect(tab.location.href).toMatch(/^render\/notebooks\/nb1\?/);
    expect(tab.location.href).toContain('encoding=pdf');
    expect(tab.location.href).toContain('pdfLayout=true');
    expect(tab.location.href).toContain('kiosk=true');
    expect(tab.location.href).toContain('orgId=7');
  });

  // No leading slash: a leading slash would resolve against the domain root regardless of
  // Grafana's own `<base href>` tag, dropping any sub-path Grafana is served under.
  it('builds a relative url, not a root-relative one, so a sub-path deployment still resolves', () => {
    const tab = fakeTab();

    navigateToNotebookPdf(tab, 'nb1', TIME_RANGE);

    expect(tab.location.href.startsWith('/')).toBe(false);
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
