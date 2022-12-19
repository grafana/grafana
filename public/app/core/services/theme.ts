import { createTheme } from '@grafana/data';
import { ThemeChangedEvent } from '@grafana/runtime';

import appEvents from '../app_events';
import { config } from '../config';
import { contextSrv } from '../core';

import { PreferencesService } from './PreferencesService';

export async function changeTheme(mode: 'dark' | 'light', runtimeOnly?: boolean) {
  const newTheme = createTheme({
    colors: {
      mode: mode,
    },
  });
  // Special feature toggle that impact theme/component looks
  newTheme.flags.topnav = config.featureToggles.topnav;

  appEvents.publish(new ThemeChangedEvent(newTheme));
  config.theme2.isDark = newTheme.isDark;

  if (runtimeOnly) {
    return;
  }

  // Add css file for new theme
  const newCssLink = document.createElement('link');
  newCssLink.rel = 'stylesheet';
  newCssLink.href = config.bootData.themePaths[newTheme.colors.mode];
  newCssLink.onload = () => {
    // Remove old css file
    const bodyLinks = document.getElementsByTagName('link');
    for (let i = 0; i < bodyLinks.length; i++) {
      const link = bodyLinks[i];

      if (link.href && link.href.includes(`build/grafana.${!newTheme.isDark ? 'dark' : 'light'}`)) {
        // Remove existing link once the new css has loaded to avoid flickering
        // If we add new css at the same time we remove current one the page will be rendered without css
        // As the new css file is loading
        link.remove();
      }
    }
  };
  document.body.appendChild(newCssLink);

  if (!contextSrv.isSignedIn) {
    return;
  }

  // Persist new theme
  const service = new PreferencesService('user');
  const currentPref = await service.load();

  await service.update({
    ...currentPref,
    theme: newTheme.colors.mode,
  });
}

export async function toggleTheme(runtimeOnly: boolean) {
  const currentTheme = config.theme2;
  changeTheme(currentTheme.isDark ? 'light' : 'dark', runtimeOnly);
}
