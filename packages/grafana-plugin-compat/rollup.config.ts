import { createRequire } from 'node:module';

import { cjsOutput, esmOutput, plugins } from '../rollup.config.parts';

const rq = createRequire(import.meta.url);
const pkg = rq('./package.json');

export default [
  {
    input: 'src/datasources.ts',
    plugins,
    output: [cjsOutput(pkg, 'grafana-plugin-compat'), esmOutput(pkg, 'grafana-plugin-compat')],
    treeshake: false,
  },
];
