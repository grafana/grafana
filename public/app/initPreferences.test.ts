import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { fetchMergedPreferences, initPreferences } from './initPreferences';

const PREFERENCES_URL = '*/apis/preferences.grafana.app/v1alpha1/namespaces/:ns/preferences/merged';

// Default 500 so any test that forgets to register its own handler fails loudly
// with a self-describing body, instead of silently returning stale defaults.
const server = setupServer(
  http.get(PREFERENCES_URL, () => HttpResponse.json({ error: 'no handler set' }, { status: 500 }))
);

beforeAll(() => server.listen());
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

/**
 * Set up grafanaBootData with the defaults
 * (signed-in user, namespace, theme assets)
 */
function setupBootData(userOverrides: Partial<typeof window.grafanaBootData.user> = {}) {
  window.grafanaBootData.user = {
    ...window.grafanaBootData.user,
    isSignedIn: true,
    ...userOverrides,
  };
  window.grafanaBootData.settings = {
    ...window.grafanaBootData.settings,
    namespace: 'default',
  };
  window.grafanaBootData.assets = {
    light: 'light.css',
    dark: 'dark.css',
  };
}

describe('fetchMergedPreferences', () => {
  beforeEach(() => {
    setupBootData();
  });

  it('does not fetch when user is not signed in', async () => {
    window.grafanaBootData.user.isSignedIn = false;
    await expect(fetchMergedPreferences()).resolves.toBeUndefined();
  });

  it('does not fetch when namespace is missing', async () => {
    window.grafanaBootData.settings.namespace = '';
    await expect(fetchMergedPreferences()).resolves.toBeUndefined();
  });

  it('returns a preferences object on success', async () => {
    server.use(http.get(PREFERENCES_URL, () => HttpResponse.json({ theme: 'light' })));

    await expect(fetchMergedPreferences()).resolves.toEqual({ theme: 'light' });
  });

  it('returns undefined when the api errors', async () => {
    server.use(http.get(PREFERENCES_URL, () => HttpResponse.json({ message: 'internal error' }, { status: 500 })));

    await expect(fetchMergedPreferences()).resolves.toBeUndefined();
  });

  it('returns undefined when fetch fails', async () => {
    server.use(http.get(PREFERENCES_URL, () => HttpResponse.error()));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(fetchMergedPreferences()).resolves.toBeUndefined();

    warnSpy.mockRestore();
  });
});

describe('initPreferences', () => {
  function setSearch(search: string) {
    window.history.replaceState({}, '', `${window.location.pathname}${search}`);
  }

  beforeEach(() => {
    setupBootData({
      theme: 'dark',
      language: 'en-US',
      weekStart: 'sunday',
      timezone: 'browser',
    });
  });

  afterEach(() => {
    setSearch('');
    document.body.classList.remove('theme-light', 'theme-dark');
    document.head.querySelectorAll('link[rel="stylesheet"]').forEach((link) => link.remove());
    document.documentElement.lang = '';
  });

  it.each([
    { field: 'theme' as const, value: 'light' },
    { field: 'weekStart' as const, value: 'monday' },
    { field: 'timezone' as const, value: 'Europe/Madrid' },
  ])('applies $field', async ({ field, value }) => {
    server.use(http.get(PREFERENCES_URL, () => HttpResponse.json({ spec: { [field]: value } })));

    await initPreferences();

    expect(window.grafanaBootData.user[field]).toBe(value);
  });

  it('applies language and updates document.documentElement.lang', async () => {
    server.use(http.get(PREFERENCES_URL, () => HttpResponse.json({ spec: { language: 'es-ES' } })));

    await initPreferences();

    expect(window.grafanaBootData.user.language).toBe('es-ES');
    expect(document.documentElement.lang).toBe('es-ES');
  });

  it('skips fields that are undefined in the response', async () => {
    server.use(http.get(PREFERENCES_URL, () => HttpResponse.json({ spec: { theme: 'light' } })));

    await initPreferences();

    expect(window.grafanaBootData.user.theme).toBe('light');
    expect(window.grafanaBootData.user.language).toBe('en-US');
    expect(window.grafanaBootData.user.weekStart).toBe('sunday');
    expect(window.grafanaBootData.user.timezone).toBe('browser');
  });

  it('returns the fetched preferences so the caller can seed the RTK Query cache', async () => {
    server.use(http.get(PREFERENCES_URL, () => HttpResponse.json({ spec: { theme: 'light' } })));

    await expect(initPreferences()).resolves.toEqual({ spec: { theme: 'light' } });
  });

  it('does not reject when the API errors', async () => {
    server.use(http.get(PREFERENCES_URL, () => HttpResponse.json({ message: 'internal error' }, { status: 500 })));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(initPreferences()).resolves.toBeUndefined();

    warnSpy.mockRestore();
  });

  it('lets the theme query param take precedence over the merged preference', async () => {
    setSearch('?theme=light');
    server.use(http.get(PREFERENCES_URL, () => HttpResponse.json({ spec: { theme: 'dark' } })));

    await initPreferences();

    expect(window.grafanaBootData.user.theme).toBe('light');
    expect(document.body.classList.contains('theme-light')).toBe(true);
    expect(document.body.classList.contains('theme-dark')).toBe(false);
  });

  it('lets the lang query param take precedence over the merged preference', async () => {
    setSearch('?lang=de');
    server.use(http.get(PREFERENCES_URL, () => HttpResponse.json({ spec: { language: 'es-ES' } })));

    await initPreferences();

    expect(window.grafanaBootData.user.language).toBe('de');
    expect(document.documentElement.lang).toBe('de');
  });
});

describe('applyTheme', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    setupBootData();
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    document.body.classList.remove('theme-light', 'theme-dark');
    document.head.querySelectorAll('link[rel="stylesheet"]').forEach((link) => link.remove());
    window.matchMedia = originalMatchMedia;
  });

  function mockPrefersDark(matches: boolean) {
    window.matchMedia = ((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })) as typeof window.matchMedia;
  }

  it('applies theme-light class and swaps the stylesheet href when theme is "light"', async () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'dark.css';
    document.head.appendChild(link);

    server.use(http.get(PREFERENCES_URL, () => HttpResponse.json({ spec: { theme: 'light' } })));

    await initPreferences();

    expect(document.body.classList.contains('theme-light')).toBe(true);
    expect(document.body.classList.contains('theme-dark')).toBe(false);
    expect(link.getAttribute('href')).toBe('light.css');
  });

  it.each([
    { prefersDark: true, expectedClass: 'theme-dark', otherClass: 'theme-light' },
    { prefersDark: false, expectedClass: 'theme-light', otherClass: 'theme-dark' },
  ])(
    'theme "system" applies $expectedClass when prefersDark=$prefersDark',
    async ({ prefersDark, expectedClass, otherClass }) => {
      mockPrefersDark(prefersDark);

      server.use(http.get(PREFERENCES_URL, () => HttpResponse.json({ spec: { theme: 'system' } })));

      await initPreferences();

      expect(document.body.classList.contains(expectedClass)).toBe(true);
      expect(document.body.classList.contains(otherClass)).toBe(false);
    }
  );

  it('removes the existing theme class before adding the new one', async () => {
    document.body.classList.add('theme-dark');

    server.use(http.get(PREFERENCES_URL, () => HttpResponse.json({ spec: { theme: 'light' } })));

    await initPreferences();

    expect(document.body.classList.contains('theme-light')).toBe(true);
    expect(document.body.classList.contains('theme-dark')).toBe(false);
  });
});
