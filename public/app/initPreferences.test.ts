import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { initPreferences } from './initPreferences';

const PREFERENCES_URL = '*/apis/preferences.grafana.app/v1alpha1/namespaces/:ns/preferences/merged';

const server = setupServer(http.get(PREFERENCES_URL, () => HttpResponse.json({}, { status: 500 })));

beforeAll(() => server.listen());
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

describe('fetchMergedPreferences', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
    window.grafanaBootData.user = {
      ...window.grafanaBootData.user,
      isSignedIn: true,
      theme: 'dark',
    };
    window.grafanaBootData.settings = {
      ...window.grafanaBootData.settings,
      namespace: 'default',
    };
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it.each([
    {
      name: 'user is not signed in',
      setup: () => {
        window.grafanaBootData.user.isSignedIn = false;
      },
    },
    {
      name: 'namespace is missing',
      setup: () => {
        window.grafanaBootData.settings.namespace = '';
      },
    },
  ])('does not fetch when $name', async ({ setup }) => {
    setup();

    await initPreferences();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(window.grafanaBootData.user.theme).toBe('dark');
  });

  it('does not apply preferences when the response is not ok', async () => {
    server.use(http.get(PREFERENCES_URL, () => HttpResponse.json({ message: 'internal error' }, { status: 500 })));

    await initPreferences();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(window.grafanaBootData.user.theme).toBe('dark');
  });

  it('does not apply preferences when fetch throws', async () => {
    server.use(http.get(PREFERENCES_URL, () => HttpResponse.error()));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await initPreferences();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(window.grafanaBootData.user.theme).toBe('dark');

    warnSpy.mockRestore();
  });
});

describe('initPreferences', () => {
  beforeEach(() => {
    window.grafanaBootData.user = {
      ...window.grafanaBootData.user,
      isSignedIn: true,
      theme: 'dark',
      language: 'en-US',
      weekStart: 'sunday',
      timezone: 'browser',
    };
    window.grafanaBootData.settings = {
      ...window.grafanaBootData.settings,
      namespace: 'default',
    };
    // `applyTheme` reads from `assets` to swap the stylesheet href.
    window.grafanaBootData.assets = {
      light: 'light.css',
      dark: 'dark.css',
    };
  });

  afterEach(() => {
    document.body.classList.remove('theme-light', 'theme-dark');
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
});

describe('applyTheme', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    window.grafanaBootData.user = {
      ...window.grafanaBootData.user,
      isSignedIn: true,
    };
    window.grafanaBootData.settings = {
      ...window.grafanaBootData.settings,
      namespace: 'default',
    };
    window.grafanaBootData.assets = {
      light: 'light.css',
      dark: 'dark.css',
    };
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
