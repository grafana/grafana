import { createRequire } from 'node:module';
import copy from 'rollup-plugin-copy';

import { entryPoint, plugins, esmOutput, cjsOutput } from '../rollup.config.parts';

const rq = createRequire(import.meta.url);
const pkg = rq('./package.json');

export default [
  {
    input: entryPoint,
    plugins: [
      ...plugins,
      copy({
        targets: [{ src: 'src/eslint', dest: 'dist' }],
      }),
    ],
    output: [cjsOutput(pkg), esmOutput(pkg, 'grafana-i18n')],
    treeshake: false,
  },
];
