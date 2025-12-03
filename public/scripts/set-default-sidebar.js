// This script runs very early (before frontend bundles) so we cannot import @grafana/data here.
// Disable the lint rule that forbids direct localStorage usage for this file.
/* eslint-disable no-restricted-syntax */

(function () {
  try {
    let key = 'grafana.navigation.docked';

    // If already set (user choice exists), do nothing.
    if (localStorage.getItem(key) !== null) {
      return;
    }

    // Try the server-provided boot data (common Grafana pattern)
    let serverDefault;
    if (
      typeof window !== 'undefined' &&
      window.grafanaBootData &&
      window.grafanaBootData.settings &&
      window.grafanaBootData.settings.featureToggles
    ) {
      serverDefault = window.grafanaBootData.settings.featureToggles.default_sidebar_docked;
    }

    // Fallback: a page-global var you can set for quick testing in index.html
    let globalDefault = typeof window !== 'undefined' ? window.__defaultSidebarDocked : undefined;

    // If neither is provided, leave the existing Grafana default (true/docked).
    let val =
      typeof serverDefault !== 'undefined'
        ? serverDefault
        : typeof globalDefault !== 'undefined'
          ? globalDefault
          : undefined;

    if (typeof val !== 'undefined') {
      // localStorage stores strings; Grafana historically uses 'true'/'false' for this key.
      localStorage.setItem(key, val ? 'true' : 'false');
    }
  } catch (e) {
    // Keep page stable if something goes wrong
  }
})();
