import type { KnipConfig } from 'knip';

const packageEntries = ['i18next.config.ts'];

const config: KnipConfig = {
  exclude: [
    // we don't often use enums, but when we do we usually include members we'll utilise in the future
    'enumMembers',
  ],
  ignore: ['**/*.gen.ts*'],
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
      ignoreDependencies: [
        // These are used by the base rollup config located outside of the packages
        '@rollup/plugin-node-resolve',
        'rollup-plugin-esbuild',
        'rollup-plugin-node-externals',
      ],
    },
    'packages/grafana-api-clients': {
      entry: [...packageEntries, 'src/scripts/generate-rtk-apis.ts', 'src/generator/plopfile.ts'],
    },
  },
};

export default config;
