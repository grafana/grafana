/* eslint-disable no-restricted-syntax */
// Early script to initialize grafana.navigation.docked from server bootdata.
// Behavior:
// - If the user already has a preference (no companion ".auto" key) we never override it.
// - If we set the value automatically, we set a companion key to mark it.
// - If later the authoritative bootdata promise resolves, we will override only if
//   the current value was previously auto-set by us.
(function () {
  try {
    let key = 'grafana.navigation.docked';
    let autoKey = key + '.auto';

    function isAutoSet() {
      try {
        return localStorage.getItem(autoKey) === '1';
      } catch (e) {
        return false;
      }
    }

    function setAuto(val) {
      try {
        localStorage.setItem(key, val ? 'true' : 'false');
        localStorage.setItem(autoKey, '1');
      } catch (e) {
        // ignore
      }
    }

    function setIfAbsent(val) {
      try {
        if (localStorage.getItem(key) === null) {
          setAuto(val);
        }
      } catch (e) {
        // ignore
      }
    }

    function setIfAutoOrAbsent(val) {
      try {
        let cur = localStorage.getItem(key);
        if (cur === null || isAutoSet()) {
          setAuto(val);
        }
      } catch (e) {
        // ignore
      }
    }

    function applyDefault(preferServer) {
      try {
        // If a real user preference exists (not marked as auto) and preferServer is true,
        // we should NOT override it. setIfAutoOrAbsent will only override if auto or absent.
        // preferServer indicates this call is from authoritative bootdata (true) or inline (false).
        let serverDefault;
        if (
          typeof window !== 'undefined' &&
          window.grafanaBootData &&
          window.grafanaBootData.settings &&
          window.grafanaBootData.settings.featureToggles &&
          typeof window.grafanaBootData.settings.featureToggles.default_sidebar_docked !== 'undefined'
        ) {
          serverDefault = window.grafanaBootData.settings.featureToggles.default_sidebar_docked;
        }

        let globalDefault = typeof window !== 'undefined' ? window.__defaultSidebarDocked : undefined;

        let val =
          typeof serverDefault !== 'undefined'
            ? serverDefault
            : typeof globalDefault !== 'undefined'
              ? globalDefault
              : undefined;

        if (typeof val === 'undefined') {
          return;
        }

        // If this is called for authoritative data (preferServer === true), allow override of previously
        // auto-set values; if it's non-authoritative (inline), only set if absent.
        if (preferServer) {
          setIfAutoOrAbsent(val);
        } else {
          setIfAbsent(val);
        }
      } catch (e) {
        // ignore
      }
    }

    // Fast-path: try immediate apply from inline bootdata (non-authoritative)
    applyDefault(false);

    // If async bootdata is fetched, wait for the promise and apply authoritative value
    try {
      if (
        typeof window !== 'undefined' &&
        window.__grafana_boot_data_promise &&
        typeof window.__grafana_boot_data_promise.then === 'function'
      ) {
        window.__grafana_boot_data_promise
          .then(function () {
            applyDefault(true);
          })
          .catch(function () {
            // ignore
          });
      }
    } catch (e) {
      // ignore
    }

    // Fallback: try again shortly after load as a final chance (authoritative)
    setTimeout(function () {
      applyDefault(true);
    }, 1500);
  } catch (e) {
    // Do not let this break the page
  }
})();
