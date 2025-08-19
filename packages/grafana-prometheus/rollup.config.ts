import dynamicImportVars from '@rollup/plugin-dynamic-import-vars';
import image from '@rollup/plugin-image';
import json from '@rollup/plugin-json';
import { createRequire } from 'node:module';

import { cjsOutput, entryPoint, esmOutput, plugins } from '../rollup.config.parts';

const rq = createRequire(import.meta.url);
const pkg = rq('./package.json');

export default [
  {
    input: entryPoint,
    plugins: [...plugins, image(), json(), dynamicImportVars()],
    output: [cjsOutput(pkg), esmOutput(pkg, 'grafana-prometheus')],
    treeshake: false,
  },
];
