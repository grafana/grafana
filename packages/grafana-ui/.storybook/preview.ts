import { Preview } from '@storybook/react';
import 'jquery';
import { getTimeZone, getTimeZones } from '@grafana/data';

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
import { withTimeZone } from '../src/utils/storybook/withTimeZone';
import { ThemedDocsContainer } from '../src/utils/storybook/ThemedDocsContainer';

// @ts-ignore
import lightTheme from '../../../public/sass/grafana.light.scss';
// @ts-ignore
import darkTheme from '../../../public/sass/grafana.dark.scss';
import { GrafanaDark, GrafanaLight } from './storybookTheme';

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
  decorators: [withTheme(handleThemeChange), withTimeZone()],
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
    options: {
      // Sort stories first by Docs Overview, then alphabetically
      // We should be able to use the builtin alphabetical sort, but is broken in SB 7.0
      // https://github.com/storybookjs/storybook/issues/22470
      storySort: (a, b) => {
        // Skip sorting for stories with nosort tag
        if (a.tags.includes('nosort') || b.tags.includes('nosort')) {
          return 0;
        }
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
  globalTypes: {
    timeZone: {
      description: 'Set the timezone for the storybook preview',
      defaultValue: getTimeZone(),
      toolbar: {
        icon: 'globe',
        items: getTimeZones(true)
          .filter((timezone) => !!timezone)
          .map((timezone) => ({
            title: timezone,
            value: timezone,
          })),
      },
    },
  },
  tags: ['autodocs'],
};

export default preview;
