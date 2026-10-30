import { type NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

import { getNavTitle } from '../utils/navBarItem-translations';

import { RedirectToUrlKey } from './context_srv';

const storageKey = 'grafana.loginSection';

export function rememberLoginSectionTitle(node: NavModelItem | undefined, pathname: string) {
  // Only catalogue labels are retained; node.text can contain user-created names.
  while (node && !getNavTitle(node.id)) {
    node = node.parentItem;
  }

  try {
    if (node?.id) {
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify({ navId: node.id, pathname, appSubUrl: config.appSubUrl })
      );
    } else {
      clearLoginSectionTitle();
    }
  } catch {
    // Remembering a tab label must not prevent navigation when storage is unavailable.
  }
}

export function clearLoginSectionTitle() {
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Storage may be disabled by the browser.
  }
}

export function getLoginSectionTitle(): string | undefined {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaPreserveLoginTabTitle, false)) {
    return undefined;
  }

  try {
    const saved = JSON.parse(window.sessionStorage.getItem(storageKey) ?? 'null');
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
    return pathname === saved.pathname ? getNavTitle(saved.navId) : undefined;
  } catch {
    return undefined;
  }
}
