import { Preview } from '@storybook/react';

import 'jquery';
import { getBuiltInThemes, getTimeZone, getTimeZones, GrafanaTheme2 } from '@grafana/data';

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

// @ts-ignore
import lightTheme from '../../../public/sass/grafana.light.scss';
// @ts-ignore
import darkTheme from '../../../public/sass/grafana.dark.scss';

const handleThemeChange = (theme: GrafanaTheme2) => {
  if (theme.colors.mode !== 'light') {
    lightTheme.unuse();
    darkTheme.use();
  } else {
    darkTheme.unuse();
    lightTheme.use();
  }
};

const allowedExtraThemes: string[] = [];

if (process.env.NODE_ENV === 'development') {
  allowedExtraThemes.push('debug');
  allowedExtraThemes.push('desertbloom');
  allowedExtraThemes.push('gildedgrove');
  allowedExtraThemes.push('gloom');
  allowedExtraThemes.push('sapphiredusk');
  allowedExtraThemes.push('tron');
}

const preview: Preview = {
  decorators: [withTheme(handleThemeChange), withTimeZone()],
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Global theme for components',
      defaultValue: 'system',
      toolbar: {
        icon: 'paintbrush',
        items: getBuiltInThemes(allowedExtraThemes).map((theme) => ({
          value: theme.id,
          title: theme.name,
        })),
        showName: true,
      },
    },
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
  initialGlobals: {
    theme: process.env.STORYBOOK_THEME || 'system',
  },
};

export default preview;
