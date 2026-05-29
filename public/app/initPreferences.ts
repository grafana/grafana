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
