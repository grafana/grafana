import type { Preferences } from '@grafana/api-clients/rtkq/preferences/v1alpha1';

export const initPreferences = async (): Promise<Preferences | undefined> => {
  const preferences = await fetchMergedPreferences();
  if (!preferences) {
    return undefined;
  }
  // URL prefs take precedence over saved preferences, matching the backend's
  // getURLPrefs behavior used when the flag is disabled.
  const params = new URLSearchParams(window.location.search);
  const themeParam = params.get('theme');
  const langParam = params.get('lang');

  const { theme, language, weekStart, timezone } = preferences.spec;
  const themeWithOverride = themeParam ?? theme;
  const languageWithOverride = langParam ?? language;

  if (themeWithOverride !== undefined) {
    window.grafanaBootData.user.theme = themeWithOverride;
    applyTheme(themeWithOverride);
  }
  if (languageWithOverride !== undefined) {
    window.grafanaBootData.user.language = languageWithOverride;
    document.documentElement.lang = languageWithOverride;
  }
  if (weekStart !== undefined) {
    window.grafanaBootData.user.weekStart = weekStart;
  }
  if (timezone !== undefined) {
    window.grafanaBootData.user.timezone = timezone;
  }

  // Return the fetched preferences so the app boot can seed the RTK Query cache,
  // avoiding a duplicate preferences/merged request from useMergedPreferencesQuery.
  return preferences;
};

export async function fetchMergedPreferences(): Promise<Preferences | undefined> {
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
  const isLightTheme =
    theme === 'system' ? !window.matchMedia('(prefers-color-scheme: dark)').matches : theme === 'light';

  window.grafanaBootData.user.lightTheme = isLightTheme;

  document.body.classList.remove('theme-light', 'theme-dark');
  document.body.classList.add(isLightTheme ? 'theme-light' : 'theme-dark');

  const { light, dark } = window.grafanaBootData.assets;
  const newHref = isLightTheme ? light : dark;

  const existingLink = Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).find(
    (link) => link.href.endsWith(light) || link.href.endsWith(dark)
  );

  if (existingLink) {
    existingLink.setAttribute('href', newHref);
  } else {
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = newHref;
    document.head.appendChild(cssLink);
  }
}
