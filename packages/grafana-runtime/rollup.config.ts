import { createRequire } from 'node:module';

import { cjsOutput, entryPoint, esmOutput, plugins } from '../rollup.config.parts';

const rq = createRequire(import.meta.url);
const pkg = rq('./package.json');

export default [
  {
    input: entryPoint,
    plugins,
    output: [cjsOutput(pkg), esmOutput(pkg, 'grafana-runtime')],
  },
  {
    input: 'src/unstable.ts',
    plugins,
    output: [cjsOutput(pkg), esmOutput(pkg, 'grafana-runtime')],
  },
];
