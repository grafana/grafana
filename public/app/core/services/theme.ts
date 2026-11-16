import { generatedAPI as preferencesAPI } from '@grafana/api-clients/rtkq/preferences/v1';
import { getBuiltInThemes, getThemeById } from '@grafana/data';
import { config, ThemeChangedEvent } from '@grafana/runtime';
import { dispatch } from 'app/store/store';

import { appEvents } from '../app_events';
import { contextSrv } from '../services/context_srv';

let themeChannel: BroadcastChannel | undefined;
let loadingThemeStylesheet: HTMLLinkElement | undefined;

function applyTheme(themeId: string) {
  const theme = getThemeById(themeId);
  appEvents.publish(new ThemeChangedEvent(theme));

  const { dark, light } = config.bootData.assets;
  const nextHref = config.bootData.assets[theme.colors.mode];
  if (!nextHref || loadingThemeStylesheet?.getAttribute('href') === nextHref) {
    return;
  }

  loadingThemeStylesheet?.remove();
  loadingThemeStylesheet = undefined;

  const hrefs = [dark, light].filter(Boolean).map((href) => new URL(href, document.baseURI).href);
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).filter((link) =>
    hrefs.includes(link.href)
  );
  const nextURL = new URL(nextHref, document.baseURI).href;
  const activeLink = links.find((link) => link.href === nextURL);
  if (activeLink) {
    links.filter((link) => link !== activeLink).forEach((link) => link.remove());
    return;
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = nextHref;
  loadingThemeStylesheet = link;
  link.onload = () => {
    // A later selection can replace this request while its stylesheet is loading.
    if (loadingThemeStylesheet === link) {
      links.forEach((previous) => previous.remove());
      loadingThemeStylesheet = undefined;
    }
  };
  link.onerror = () => {
    if (loadingThemeStylesheet === link) {
      link.remove();
      loadingThemeStylesheet = undefined;
    }
  };
  document.head.insertBefore(link, document.head.firstChild);
}

export function connectThemeChannel() {
  if (typeof BroadcastChannel === 'undefined') {
    return;
  }

  const { id, orgId } = contextSrv.user;
  const channel = new BroadcastChannel(`grafana:theme:${config.appSubUrl}:${id}:${orgId}`);
  channel.onmessage = ({ data }: MessageEvent<unknown>) => {
    if (typeof data === 'string' && getBuiltInThemes([data]).some(({ id }) => id === data)) {
      applyTheme(data);
    }
  };
  themeChannel = channel;

  return () => {
    channel.close();
    if (themeChannel === channel) {
      themeChannel = undefined;
    }
  };
}

export async function changeTheme(themeId: string, runtimeOnly?: boolean) {
  applyTheme(themeId);
  themeChannel?.postMessage(themeId);

  if (runtimeOnly) {
    return;
  }

  if (!contextSrv.isSignedIn) {
    return;
  }

  // Persist new theme
  const resourceName = contextSrv.user.uid ? `user-${contextSrv.user.uid}` : 'user';
  await dispatch(
    preferencesAPI.endpoints.updatePreferences.initiate({
      name: resourceName,
      patch: { spec: { theme: themeId } },
    })
  ).unwrap();
}

export async function toggleTheme(runtimeOnly: boolean) {
  const currentTheme = config.theme2;
  return changeTheme(currentTheme.isDark ? 'light' : 'dark', runtimeOnly);
}
