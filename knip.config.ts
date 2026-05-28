import type { KnipConfig } from 'knip';

const packageIgnoreDeps = [
  // These are used by the base rollup config located outside of the packages
  '@rollup/plugin-node-resolve',
  'rollup-plugin-esbuild',
  'rollup-plugin-node-externals',
];

const packageEntries = ['i18next.config.ts'];

const config: KnipConfig = {
  compilers: {
    mdx: true,
  },
  exclude: [
    // we don't often use enums, but when we do we usually include members we'll utilise in the future
    'enumMembers',
  ],
  ignore: ['**/*.gen.ts*', '**/*_gen.ts*'],
  ignoreBinaries: ['make'],
  workspaces: {
    '.': {
      // TODO figure out how to properly include webpack/jest configs
      jest: false,
      webpack: false,
      project: ['!devenv', '!packages', '!pkg', '!public/app/plugins'],
    },
    'public/app/plugins/datasource/*': {
      // TODO figure out how to properly include webpack/jest configs
      webpack: false,
      jest: true,
      entry: [...packageEntries, 'module.{ts,tsx,js}'],
    },
    'e2e-playwright/test-plugins/*': {
      // TODO figure out how to properly include webpack/jest configs
      webpack: false,
      entry: [...packageEntries, 'module.{ts,tsx,js}', 'plugins/*/module.{ts,tsx,js}'],
    },
    'packages/**': {
      entry: packageEntries,
      ignoreDependencies: packageIgnoreDeps,
      jest: true,
    },
    // `grafana-alerting` has stories that are included in `grafana-ui`'s storybook
    // this is a bad idea
    // `grafana-alerting` should have its own storybook (like `grafana-flamegraph`), then we could remove this special block
    'packages/grafana-alerting': {
      entry: [...packageEntries, '**/*.story.tsx'],
      ignoreDependencies: [...packageIgnoreDeps, '@storybook/react-webpack5', '@storybook/react'],
    },
    'packages/grafana-api-clients': {
      entry: [...packageEntries, 'src/scripts/generate-rtk-apis.ts', 'src/generator/generate.ts'],
    },
    'packages/grafana-plugin-configs': {
      // TODO figure out how to properly include webpack/jest configs
      webpack: false,
      // this package contains shared dependencies that aren't immediately used by the package
      ignoreDependencies: ['.*'],
    },
  },
};

export default config;
