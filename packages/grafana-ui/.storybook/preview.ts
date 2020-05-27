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
import { withPaddedStory } from '../src/utils/storybook/withPaddedStory';
// @ts-ignore
import lightTheme from '../../../public/sass/grafana.light.scss';
// @ts-ignore
import darkTheme from '../../../public/sass/grafana.dark.scss';
import { GrafanaLight, GrafanaDark } from './storybookTheme';
import { configure, addDecorator, addParameters } from '@storybook/react';
import { withKnobs } from '@storybook/addon-knobs';

const handleThemeChange = (theme: any) => {
  if (theme !== 'light') {
    lightTheme.unuse();
    darkTheme.use();
  } else {
    darkTheme.unuse();
    lightTheme.use();
  }
};
addDecorator(withTheme(handleThemeChange));
addDecorator(withKnobs);
addDecorator(withPaddedStory);

addParameters({
  info: {},
  darkMode: {
    dark: GrafanaDark,
    light: GrafanaLight,
  },
  options: {
    theme: GrafanaDark,
    showPanel: true,
    showRoots: true,
    panelPosition: 'right',
    showNav: true,
    isFullscreen: false,
    isToolshown: true,
    storySort: (a: any, b: any) => {
      if (a[1].kind.split('/')[0] === 'Docs Overview') {
        return -1;
      } else if (b[1].kind.split('/')[0] === 'Docs Overview') {
        return 1;
      }
      return a[1].id.localeCompare(b[1].id);
    },
  },
  knobs: {
    escapeHTML: false,
  },
});

// @ts-ignore
configure(require.context('../src', true, /\.story\.(js|jsx|ts|tsx|mdx)$/), module);
