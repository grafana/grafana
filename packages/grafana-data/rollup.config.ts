import json from '@rollup/plugin-json';
import { createRequire } from 'node:module';

import { entryPoint, plugins, esmOutput, cjsOutput } from '../rollup.config.parts';

const rq = createRequire(import.meta.url);
const pkg = rq('./package.json');

const grafanaDataPlugins = [...plugins, json()];

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
