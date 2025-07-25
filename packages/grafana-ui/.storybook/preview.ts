import { Preview } from '@storybook/react';
import { initialize, mswLoader } from 'msw-storybook-addon';

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
import { ThemedDocsContainer } from '../src/utils/storybook/ThemedDocsContainer';

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

/*
 * Initializes MSW
 * See https://github.com/mswjs/msw-storybook-addon#configuring-msw
 * to learn how to customize it
 */
initialize({
  onUnhandledRequest: 'bypass',
  serviceWorker: {
    // Important! The path must be relative to work when we deploy storybook to subpaths (e.g. /ui/canary)
    url: 'mockServiceWorker.js',
  },
});

const preview: Preview = {
  decorators: [withTheme(handleThemeChange), withTimeZone()],
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    docs: {
      container: ThemedDocsContainer,
    },
    a11y: { test: 'error' },
    knobs: {
      disable: true,
    },
    options: {
      // Sort stories first by Docs Overview, then alphabetically
      // We should be able to use the builtin alphabetical sort, but is broken in SB 7.0
      // https://github.com/storybookjs/storybook/issues/22470

      // Story sorting is weird - All stories are sorted as a single 1D list, but then grouped in the UI.
      // Story titles are generally in the format of [Category]/[Component]/[Story]. However, some categories
      // will have an additional `Deprecated` sub folder before the [Component]
      //
      // We want to have multi-level sorting where:
      // - The top level category has an explicit order
      // - Components are sorted alphabetically within their category
      //   - Except the Deprecated folder, which is sorted to the bottom
      // - Stories per component use the default file sort order
      storySort: (a, b) => {
        const CATEGORY_ORDER = [
          // Should all be lowercase
          'docs overview',
          'foundations',
          'iconography',
          'layout',

          'forms',
          'inputs',
          'pickers',
          'date time pickers',

          'information',
          'overlays',
          'utilities',
          'navigation',

          'plugins',
          'alerting',
          'developers',
        ];

        const aTitle = a.title.toLowerCase();
        const bTitle = b.title.toLowerCase();
        const [aCategory, aComponent] = aTitle.split('/');
        const [bCategory, bComponent] = bTitle.split('/');

        //
        // Sort by category order first
        const aCategoryIndex = CATEGORY_ORDER.indexOf(aCategory);
        const bCategoryIndex = CATEGORY_ORDER.indexOf(bCategory);

        if (aCategoryIndex === -1 || bCategoryIndex === -1) {
          const category = aCategoryIndex === -1 ? aCategory : bCategory;
          throw new Error(
            `Category ${category} not found in CATEGORY_ORDER. Prefer reusing the existing categories, or add to CATEGORY_ORDER.`
          );
        }

        if (aCategoryIndex !== bCategoryIndex) {
          return aCategoryIndex - bCategoryIndex;
        }

        //
        // Sort 'Deprecated' subfolders to the bottom
        if (aTitle.includes('deprecated') && !bTitle.includes('deprecated')) {
          return 1;
        } else if (bTitle.includes('deprecated') && !aTitle.includes('deprecated')) {
          return -1;
        }

        //
        // Sort Docs to the top
        if (a.type === 'docs' && b.type !== 'docs') {
          return -1;
        } else if (a.type !== 'docs' && b.type === 'docs') {
          return 1;
        }

        //
        // If sorting different components, sort alphabetically
        if (aComponent !== bComponent) {
          return aComponent.localeCompare(bComponent, undefined, { numeric: true });
        }

        // Otherwise, sort stories within componmments according to source order
        return 0;
      },
    },
  },
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
  tags: ['autodocs'],
  loaders: [mswLoader],
};

export default preview;
