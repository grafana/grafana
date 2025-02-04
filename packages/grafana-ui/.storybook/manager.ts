import { addons } from '@storybook/manager-api';
import { getThemeById } from '@grafana/data';
import { createStorybookTheme } from './storybookTheme';

const darkTheme = getThemeById('debug');
addons.setConfig({
  isFullscreen: false,
  panelPosition: 'right',
  showNav: true,
  showPanel: true,
  showToolbar: true,
  sidebar: {
    showRoots: true,
  },
  theme: createStorybookTheme(darkTheme),
});
