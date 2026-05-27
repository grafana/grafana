import type { KnipConfig } from 'knip';

const packageIgnoreDeps = [
  // These are used by the base rollup config located outside of the packages
  '@rollup/plugin-node-resolve',
  'rollup-plugin-esbuild',
  'rollup-plugin-node-externals',
];

const packageEntries = ['i18next.config.ts'];

const config: KnipConfig = {
  exclude: [
    // we don't often use enums, but when we do we usually include members we'll utilise in the future
    'enumMembers',
  ],
  ignore: ['**/*.gen.ts*', '**/*_gen.ts*'],
  ignoreBinaries: ['make'],
  workspaces: {
    // TODO figure out how to properly include webpack/jest configs
    '.': {
      jest: false,
    },
    'public/app/plugins/datasource/*': {
      webpack: false,
    },
    'e2e-playwright/test-plugins/*': {
      webpack: false,
    },
    'packages/**': {
      entry: packageEntries,
      ignoreDependencies: packageIgnoreDeps,
    },
    // `grafana-alerting` has stories that are included in `grafana-ui`'s storybook
    // this is a bad idea
    // `grafana-alerting` should have its own storybook (like `grafana-flamegraph`), then we could remove this special block
    'packages/grafana-alerting': {
      entry: [...packageEntries, '**/*.story.tsx'],
      ignoreDependencies: [...packageIgnoreDeps, '@storybook/react-webpack5', '@storybook/react'],
    },
    'packages/grafana-api-clients': {
      entry: [...packageEntries, 'src/scripts/generate-rtk-apis.ts', 'src/generator/plopfile.ts'],
    },
  },
};

export default config;
