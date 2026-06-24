import { Preview } from '@storybook/react';

import { getBuiltInThemes, getTimeZone, getTimeZones, GrafanaTheme2 } from '@grafana/data';

import { withTheme } from '../src/utils/storybook/withTheme';
import { withTimeZone } from '../src/utils/storybook/withTimeZone';

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
  decorators: [withTheme(), withTimeZone()],
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
