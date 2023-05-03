import { addons } from '@storybook/addons';
import { GrafanaDark } from './storybookTheme';

addons.setConfig({
  sidebar: {
    showRoots: false,
  },
  theme: GrafanaDark,
});
