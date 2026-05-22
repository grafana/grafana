import type { PreferencesSpec } from '@grafana/api-clients/rtkq/preferences/v1alpha1';

export const initPreferences = async () => {
  const preferences = await fetchMergedPreferences();
  if (!preferences) {
    return;
  }
  const { theme, language, weekStart, timezone } = preferences.spec;
  if (theme !== undefined) {
    window.grafanaBootData.user.theme = theme;
    applyTheme(theme);
  }
  if (language !== undefined) {
    window.grafanaBootData.user.language = language;
    document.documentElement.lang = language;
  }
  if (weekStart !== undefined) {
    window.grafanaBootData.user.weekStart = weekStart;
  }
  if (timezone !== undefined) {
    window.grafanaBootData.user.timezone = timezone;
  }
};

export async function fetchMergedPreferences(): Promise<{ spec: PreferencesSpec } | undefined> {
  const namespace = window.grafanaBootData?.settings?.namespace;
  const isSignedIn = window.grafanaBootData?.user?.isSignedIn;

  if (!isSignedIn || !namespace) {
    return undefined;
  }

  try {
    const url = `apis/preferences.grafana.app/v1alpha1/namespaces/${namespace}/preferences/merged`;
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) {
      return undefined;
    }
    return await resp.json();
  } catch (err) {
    console.warn('Failed to fetch merged preferences', err);
    return undefined;
  }
}

// Mirrors the DOM theme application from the inline boot script in index.html,
// but using the merged-preferences value. Updates lightTheme, the <body> class,
// and the theme stylesheet <link href>.
function applyTheme(theme: string) {
  // The per-theme CSS still contains some global styles needed
  // to render the page correctly.
  const cssLink = document.createElement('link');
  cssLink.rel = 'stylesheet';

  if (theme === 'system') {
    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    window.grafanaBootData.user.lightTheme = !darkQuery.matches;
  }

  const isLightTheme = window.grafanaBootData.user.lightTheme;

  document.body.classList.add(isLightTheme ? 'theme-light' : 'theme-dark');

  cssLink.href = window.grafanaBootData.assets[isLightTheme ? 'light' : 'dark'];
  document.head.appendChild(cssLink);
}
