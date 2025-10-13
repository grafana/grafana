import image from '@rollup/plugin-image';
import { createRequire } from 'node:module';

import { cjsOutput, entryPoint, esmOutput, plugins, tsDeclarationOutput } from '../rollup.config.parts';

const rq = createRequire(import.meta.url);
const pkg = rq('./package.json');

export default [
  {
    input: entryPoint,
    plugins: [...plugins, image()],
    output: [cjsOutput(pkg), esmOutput(pkg, 'grafana-prometheus')],
  },
  tsDeclarationOutput(pkg),
];
