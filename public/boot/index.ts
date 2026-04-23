import { type CurrentUserDTO, type GrafanaConfig, type NavLinkDTO } from '@grafana/data';

const publicDashboardAccessToken = window.__grafanaPublicDashboardAccessToken;
// Grafana can only fail to load once
// However, it can fail to load in multiple different places
// To avoid double reporting the error, we use this boolean to check if we've already failed
let hasFailedToBoot = false;
window.__grafana_load_failed = function (err: unknown) {
  if (hasFailedToBoot) {
    return;
  }
  hasFailedToBoot = true;
  console.error('Failed to load Grafana', err);
  document.querySelector('.fs-variant-loader')?.classList.add('fs-hidden');
  document.querySelector('.fs-variant-error')?.classList.remove('fs-hidden');

  // not a secure random value, but collisions are highly unlikely and 1/1000_000_000 lost requests
  // doesn't make a difference.
  fetch(`/-/fe-boot-error?ts=${Date.now()}${Math.random()}`, {
    // This "should" be a POST request, but we must use GET to interact with the correct service.
    // no-store and ?ts=_ are used to ensure the request isn't cached.
    method: 'GET',
    cache: 'no-store',
  }).catch((err) => {
    console.error('Failed to report boot error to backend: ', err);
  });
};

window.onload = function () {
  if (window.__grafana_app_bundle_loaded) {
    delete window.__grafanaPublicDashboardAccessToken;
    return;
  }
  window.__grafana_load_failed(new Error('App bundle not loaded'));
};

let hasSetLoading = false;
function setLoading() {
  if (hasSetLoading) {
    return;
  }

  document.querySelector('.preloader')?.classList.add('fs-loader-starting-up');
  hasSetLoading = true;
}

const CHECK_INTERVAL = 1 * 1000;

function getCookie(name: string) {
  const cookies = document.cookie.split(';').map((c) => c.trim());

  for (const cookie of cookies) {
    if (cookie.startsWith(name + '=')) {
      return cookie.substring(name.length + 1);
    }
  }

  return undefined;
}

function getSessionExpiration() {
  const value = getCookie('grafana_session_expiry');
  if (!value) {
    return undefined;
  }
  const realExpiresSeconds = parseInt(value, 10);
  const expiresSeconds = Math.max(realExpiresSeconds - 10, 0); // Rotate 10s before the real expiration
  const expiration = new Date(expiresSeconds * 1000);
  return expiration;
}

async function rotateSession() {
  await fetch('/api/user/auth-tokens/rotate', { method: 'POST' });
}

interface BootApiResponse {
  navTree: NavLinkDTO[];
  settings: GrafanaConfig & { loginError?: string }; // loginError is enterprise-only
  user: CurrentUserDTO;
  autoLoginRedirectURL?: string;
  code?: string; // present with value 'Loading' on 503 responses
}

type FetchBootDataResult = undefined | { redirect: string } | BootApiResponse;

/**
 * Fetches boot data from the server. If it returns undefined, it should be retried later.
 * Will return a rejected promise on unrecoverable errors.
 **/
async function fetchBootData(): Promise<FetchBootDataResult> {
  const queryParams = new URLSearchParams(window.location.search);

  let path = '/bootdata';
  // call a special bootdata url with the public access token
  // this is needed to set the access token and correct org for public dashboards on the ST backend
  if (publicDashboardAccessToken) {
    path += `/${publicDashboardAccessToken}`;
  }
  // pass the search params through to the bootdata request
  // this allows for overriding the theme/language etc
  const bootDataUrl = new URL(path, window.location.origin);
  for (const [key, value] of queryParams.entries()) {
    bootDataUrl.searchParams.append(key, value);
  }

  const resp = await fetch(bootDataUrl);
  // manual redirect for custom domains
  // see pkg/middleware/validate_host.go
  if (resp.status === 204) {
    const redirectDomain = resp.headers.get('Redirect-Domain');
    if (redirectDomain) {
      window.location.hostname = redirectDomain;
      return;
    }
  }
  const textResponse = await resp.text();

  let rawBootData;
  try {
    rawBootData = JSON.parse(textResponse);
  } catch {
    throw new Error('Unexpected response type: ' + textResponse);
  }

  // If the response is 503, instruct the caller to retry again later.
  if (resp.status === 503 && rawBootData.code === 'Loading') {
    return;
  }

  if (!resp.ok) {
    throw new Error('Unexpected response body: ' + textResponse);
  }

  // Handle SSO auto-login redirection from /bootdata.
  // Only redirect if there's no login error to avoid redirect loops.
  if (rawBootData.autoLoginRedirectURL && !rawBootData.settings.loginError && !queryParams.has('disableAutoLogin')) {
    // Copied from context_srv.setRedirectToUrl
    const redirectPath = window.location.href.substring(window.location.origin.length);
    if (redirectPath !== '/login') {
      window.sessionStorage.setItem(
        'redirectTo',
        encodeURIComponent(window.location.href.substring(window.location.origin.length))
      );
    }

    return { redirect: rawBootData.autoLoginRedirectURL };
  }

  return rawBootData;
}

/**
 * Loads the boot data from the server, retrying if it's unavailable.
 **/
function loadBootData(): Promise<{ redirect: string } | BootApiResponse> {
  return new Promise((resolve, reject) => {
    const attemptFetch = async () => {
      try {
        const sessionExpiration = getSessionExpiration();
        const now = new Date();

        // If the session has expired, don't continue trying to fetch boot data
        if (sessionExpiration && now >= sessionExpiration) {
          await rotateSession();
        }
      } catch (error) {
        // Just ignore any errors in session rotation. The user can just log in again.
        console.warn('Failed to rotate session', error);
      }

      try {
        const bootData = await fetchBootData();

        // If the boot data is undefined, retry after a delay
        if (!bootData) {
          setLoading();
          setTimeout(attemptFetch, CHECK_INTERVAL);
          return;
        }

        resolve(bootData);
      } catch (error) {
        reject(error);
      }
    };

    // Start the first attempt immediately
    attemptFetch();
  });
}

async function initGrafana() {
  // Preserve a mix of values from the initial boot data, and from the backend
  // - nav tree and user info come from the backend
  // - merge settings from both. FS settings contains less values
  // - build info edition comes from the backend
  const bootData = await loadBootData();

  // If the backend wants us to redirect, we reject this promise to avoid booting the rest of the app.
  if ('redirect' in bootData) {
    return Promise.reject({ redirect: bootData.redirect });
  }

  window.grafanaBootData.settings = {
    ...bootData.settings,
    ...window.grafanaBootData.settings,
  };
  window.grafanaBootData.navTree = bootData.navTree;
  window.grafanaBootData.user = bootData.user;
  if (bootData.settings?.buildInfo?.edition) {
    window.grafanaBootData.settings.buildInfo.edition = bootData.settings.buildInfo.edition;
  }

  // The per-theme CSS still contains some global styles needed
  // to render the page correctly.
  const cssLink = document.createElement('link');
  cssLink.rel = 'stylesheet';

  const theme = window.grafanaBootData.user.theme;
  if (theme === 'system') {
    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    window.grafanaBootData.user.lightTheme = !darkQuery.matches;
  }

  const isLightTheme = window.grafanaBootData.user.lightTheme;

  document.body.classList.add(isLightTheme ? 'theme-light' : 'theme-dark');

  const lang = window.grafanaBootData.user.language;
  if (lang) {
    document.documentElement.lang = lang;
  }

  cssLink.href = window.grafanaBootData.assets[isLightTheme ? 'light' : 'dark'];
  document.head.appendChild(cssLink);

  // Set custom fav icon if set in whitelabeling settings
  // @ts-ignore - enterprise only setting.
  const customFavIcon = window.grafanaBootData.settings.whitelabeling?.favIcon;
  if (customFavIcon) {
    let existingFavIconEl = document.getElementById('grafana_favicon');

    if (existingFavIconEl && !(existingFavIconEl instanceof HTMLLinkElement)) {
      return;
    }

    const favicon = existingFavIconEl ?? document.createElement('link');

    favicon.rel = 'icon';
    favicon.type = 'image/png';
    favicon.id = 'grafana_favicon';

    if (!existingFavIconEl) {
      document.head.appendChild(favicon);
    }

    favicon.href = customFavIcon;
  }
}

window.__grafana_boot_data_promise = initGrafana();
window.__grafana_boot_data_promise.catch((err) => {
  // initGrafana can throw a `{ redirect: string }` object to indicate that the frontend should redirect without booting the app.
  if (err && err.redirect && typeof err.redirect === 'string') {
    window.location.href = err.redirect;
    return;
  }

  console.error('__grafana_boot_data_promise rejected', err);
  window.__grafana_load_failed(err);
});
