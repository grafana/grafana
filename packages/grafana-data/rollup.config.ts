import json from '@rollup/plugin-json';
import { createRequire } from 'node:module';
import copy from 'rollup-plugin-copy';

import { entryPoint, plugins, esmOutput, cjsOutput } from '../rollup.config.parts';

const rq = createRequire(import.meta.url);
const pkg = rq('./package.json');

const grafanaDataPlugins = [
  ...plugins,
  copy({
    targets: [
      {
        src: 'src/themes/schema.generated.json',
        dest: 'dist/esm/',
      },
      {
        src: 'src/themes/themeDefinitions/*.json',
        dest: 'dist/esm/',
      },
    ],
    flatten: false,
  }),
  copy({
    // tsc's declaration-only emit does not carry handwritten .d.ts inputs over to
    // dist/types, but the declarations emitted for luxon_moment_compat import './luxon',
    // so ship the file alongside them or type resolution breaks in the published tarball.
    targets: [
      {
        src: 'src/datetime/luxon_moment_compat/luxon.d.ts',
        dest: 'dist/types/datetime/luxon_moment_compat/',
      },
    ],
  }),
  json(),
];

export default [
  {
    input: entryPoint,
    plugins: grafanaDataPlugins,
    output: [cjsOutput(pkg, 'grafana-data'), esmOutput(pkg, 'grafana-data')],
    treeshake: false,
  },
  {
    input: 'src/unstable.ts',
    plugins: grafanaDataPlugins,
    output: [cjsOutput(pkg, 'grafana-data'), esmOutput(pkg, 'grafana-data')],
    treeshake: false,
  },
];
