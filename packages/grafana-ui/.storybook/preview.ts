import { Preview } from '@storybook/react';
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
import { ThemedDocsContainer } from '../src/utils/storybook/ThemedDocsContainer';

// @ts-ignore
import lightTheme from './grafana.light.scss';
// @ts-ignore
import darkTheme from './grafana.dark.scss';
import { GrafanaLight, GrafanaDark } from './storybookTheme';

const handleThemeChange = (theme: any) => {
  if (theme !== 'light') {
    lightTheme.unuse();
    darkTheme.use();
  } else {
    darkTheme.unuse();
    lightTheme.use();
  }
};

const preview: Preview = {
  decorators: [withTheme(handleThemeChange)],
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    darkMode: {
      dark: GrafanaDark,
      light: GrafanaLight,
    },
    docs: {
      container: ThemedDocsContainer,
    },
    knobs: {
      disable: true,
    },
    layout: 'fullscreen',
    options: {
      // Sort stories first by Docs Overview, then alphabetically
      // We should be able to use the builtin alphabetical sort, but is broken in SB 7.0
      // https://github.com/storybookjs/storybook/issues/22470
      storySort: (a, b) => {
        if (a.title.startsWith('Docs Overview')) {
          if (b.title.startsWith('Docs Overview')) {
            return 0;
          }
          return -1;
        } else if (b.title.startsWith('Docs Overview')) {
          return 1;
        }
        return a.id === b.id ? 0 : a.id.localeCompare(b.id, undefined, { numeric: true });
      },
    },
  },
};

export default preview;
