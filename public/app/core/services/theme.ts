import { generatedAPI as preferencesAPI } from '@grafana/api-clients/rtkq/preferences/v1';
import { getThemeById } from '@grafana/data/internal';
import { config, ThemeChangedEvent } from '@grafana/runtime';
import { dispatch } from 'app/store/store';

import { appEvents } from '../app_events';
import { contextSrv } from '../services/context_srv';

export async function changeTheme(themeId: string, runtimeOnly?: boolean) {
  const oldTheme = config.theme2;

  const newTheme = getThemeById(themeId);

  appEvents.publish(new ThemeChangedEvent(newTheme));

  // Add css file for new theme
  if (oldTheme.colors.mode !== newTheme.colors.mode) {
    // Match the URL the backend gave us rather than a path fragment: the build directory name
    // differs per bundler and the URL may carry a CDN origin.
    const oldCssHref = config.bootData.assets[oldTheme.colors.mode];
    const newCssLink = document.createElement('link');
    newCssLink.rel = 'stylesheet';
    newCssLink.href = config.bootData.assets[newTheme.colors.mode];
    newCssLink.onload = () => {
      // Remove old css file
      const bodyLinks = document.getElementsByTagName('link');
      for (let i = 0; i < bodyLinks.length; i++) {
        const link = bodyLinks[i];

        if (oldCssHref && link.href.endsWith(oldCssHref)) {
          // Remove existing link once the new css has loaded to avoid flickering
          // If we add new css at the same time we remove current one the page will be rendered without css
          // As the new css file is loading
          link.remove();
        }
      }
    };
    document.head.insertBefore(newCssLink, document.head.firstChild);
  }

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
  changeTheme(currentTheme.isDark ? 'light' : 'dark', runtimeOnly);
}
