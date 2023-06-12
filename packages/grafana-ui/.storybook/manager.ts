import { addons } from '@storybook/manager-api';
import { GrafanaDark } from './storybookTheme';

addons.setConfig({
  isFullscreen: false,
  panelPosition: 'right',
  showNav: true,
  showPanel: true,
  showToolbar: true,
  sidebar: {
    showRoots: true,
  },
  theme: GrafanaDark,
});
