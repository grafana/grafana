import 'jquery';
import '../../../public/vendor/flot/jquery.flot.js';
import '../../../public/vendor/flot/jquery.flot.selection';
import '../../../public/vendor/flot/jquery.flot.time';
import '../../../public/vendor/flot/jquery.flot.stack';
import '../../../public/vendor/flot/jquery.flot.stackpercent';
import '../../../public/vendor/flot/jquery.flot.fillbelow';
import '../../../public/vendor/flot/jquery.flot.crosshair';
import '../../../public/vendor/flot/jquery.flot.dashes';
import '../../../public/vendor/flot/jquery.flot.gauge';
import { withTheme } from '../src/utils/storybook/withTheme';
// @ts-ignore
import lightTheme from '../../../public/sass/grafana.light.scss';
// @ts-ignore
import darkTheme from '../../../public/sass/grafana.dark.scss';
import { GrafanaLight, GrafanaDark } from './storybookTheme';
import addons from '@storybook/addons';
import { ThemedDocsContainer } from '../src/utils/storybook/ThemedDocsContainer';

const handleThemeChange = (theme: any) => {
  if (theme !== 'light') {
    lightTheme.unuse();
    darkTheme.use();
  } else {
    darkTheme.unuse();
    lightTheme.use();
  }
};

addons.setConfig({
  showRoots: false,
  theme: GrafanaDark,
});

export const decorators = [withTheme(handleThemeChange)];

export const parameters = {
  docs: {
    container: ThemedDocsContainer,
  },
  darkMode: {
    dark: GrafanaDark,
    light: GrafanaLight,
  },
  layout: 'fullscreen',
  actions: { argTypesRegex: '^on[A-Z].*' },
  options: {
    showPanel: true,
    panelPosition: 'right',
    showNav: true,
    isFullscreen: false,
    isToolshown: true,
    storySort: {
      method: 'alphabetical',
      // Order Docs Overview and Docs Overview/Intro story first
      order: ['Docs Overview', ['Intro']],
    },
  },
  knobs: {
    disable: true,
  },
};
