import { createRequire } from 'node:module';

import { entryPoint, plugins, esmOutput, cjsOutput, tsDeclarationOutput } from '../rollup.config.parts';

const rq = createRequire(import.meta.url);
const pkg = rq('./package.json');

export default [
  {
    input: entryPoint,
    plugins,
    output: [cjsOutput(pkg), esmOutput(pkg, 'grafana-data')],
  },
  tsDeclarationOutput(pkg),
];
