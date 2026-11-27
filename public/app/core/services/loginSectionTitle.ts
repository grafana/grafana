import { type NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

import { getNavTitle } from '../utils/navBarItem-translations';

import { contextSrv, RedirectToUrlKey } from './context_srv';

const storageKey = 'grafana.loginSection';

function readSavedSection() {
  try {
    return JSON.parse(window.sessionStorage.getItem(storageKey) ?? 'null');
  } catch {
    return undefined;
  }
}

export function rememberLoginSectionTitle(node: NavModelItem | undefined, pathname: string) {
  // Only catalogue labels are retained; node.text can contain user-created names.
  while (node && !getNavTitle(node.id)) {
    node = node.parentItem;
  }

  try {
    if (node?.id) {
      const saved = readSavedSection();
      // Chrome updates must not erase a dashboard name captured by its renderer.
      const dashboard =
        getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaPreserveDashboardLoginTabTitle, false) &&
        saved?.navId === node.id &&
        saved.pathname === pathname &&
        saved.appSubUrl === config.appSubUrl &&
        saved.dashboard?.orgId === contextSrv.user.orgId
          ? saved.dashboard
          : undefined;
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify({ navId: node.id, pathname, appSubUrl: config.appSubUrl, dashboard })
      );
    } else {
      clearLoginSectionTitle();
    }
  } catch {
    // Remembering a tab label must not prevent navigation when storage is unavailable.
  }
}

export function rememberLoginDashboardTitle(title: string, pathname: string) {
  if (
    !getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaPreserveLoginTabTitle, false) ||
    !getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaPreserveDashboardLoginTabTitle, false) ||
    !contextSrv.user.isSignedIn
  ) {
    return;
  }

  try {
    const saved = readSavedSection();
    if (saved?.navId === 'dashboards/browse' && saved.pathname === pathname && saved.appSubUrl === config.appSubUrl) {
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify({ ...saved, dashboard: { title, orgId: contextSrv.user.orgId } })
      );
    }
  } catch {
    // Remembering a dashboard name must not prevent rendering when storage is unavailable.
  }
}

export function clearLoginSectionTitle() {
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Storage may be disabled by the browser.
  }
}

export function getLoginSectionTitle(
  preserveDashboardTitle = getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaPreserveDashboardLoginTabTitle, false)
): string | undefined {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaPreserveLoginTabTitle, false)) {
    return undefined;
  }

  try {
    const saved = readSavedSection();
    const redirect = window.sessionStorage.getItem(RedirectToUrlKey);
    if (!saved || !redirect || typeof saved.navId !== 'string' || saved.appSubUrl !== config.appSubUrl) {
      return undefined;
    }

    const url = new URL(decodeURIComponent(redirect), window.location.origin);
    if (url.origin !== window.location.origin) {
      return undefined;
    }
    let pathname = url.pathname;
    if (config.appSubUrl && (pathname === config.appSubUrl || pathname.startsWith(config.appSubUrl + '/'))) {
      pathname = pathname.slice(config.appSubUrl.length) || '/';
    }
    // Section metadata is saved during navigation, independently of the login redirect.
    // Section metadata is saved during navigation, independently of the login redirect because we need navigationNode.navId to build the title.
    // We only use it when the saved pathname matches the actual redirect destination. It may not match in case user is not logged out from Grafana but when opening a new tab and trying to access a new page while logged out. In that case nothing updated the `grafana.loginSection` yet and so we don't show any title, which is expected.
    if (pathname !== saved.pathname) {
      return undefined;
    }
    if (
      preserveDashboardTitle &&
      saved.navId === 'dashboards/browse' &&
      typeof saved.dashboard?.title === 'string' &&
      saved.dashboard.title &&
      (!url.searchParams.has('orgId') || Number(url.searchParams.get('orgId')) === saved.dashboard.orgId)
    ) {
      return saved.dashboard.title;
    }
    return getNavTitle(saved.navId);
  } catch {
    return undefined;
  }
}
