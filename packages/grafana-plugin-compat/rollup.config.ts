import { createRequire } from 'node:module';

import { entryPoint, esmOutput, plugins } from '../rollup.config.parts';

const rq = createRequire(import.meta.url);
const pkg = rq('./package.json');

export default [
  {
    input: entryPoint,
    plugins,
    output: [esmOutput(pkg, 'grafana-plugin-compat')],
    treeshake: false,
  },
];
