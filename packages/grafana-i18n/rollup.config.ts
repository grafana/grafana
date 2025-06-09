import { createRequire } from 'node:module';
import { dirname } from 'node:path';

import { entryPoint, plugins, esmOutput, cjsOutput, tsDeclarationOutput } from '../rollup.config.parts';

const rq = createRequire(import.meta.url);
const pkg = rq('./package.json');

export default [
  {
    input: entryPoint,
    plugins,
    output: [cjsOutput(pkg), esmOutput(pkg, 'grafana-i18n')],
  },
  {
    input: 'src/eslint-plugin.cjs',
    plugins,
    output: [
      {
        format: 'cjs',
        sourcemap: true,
        dir: dirname(pkg.publishConfig.main),
        entryFileNames: '[name].cjs',
        esModule: true,
        interop: 'compat',
      },
    ],
  },
  tsDeclarationOutput(pkg),
  tsDeclarationOutput(pkg, {
    input: './compiled/eslint-plugin.d.ts',
    output: [
      {
        file: './dist/cjs/eslint-plugin.d.cts',
        format: 'cjs',
      },
    ],
  }),
];
