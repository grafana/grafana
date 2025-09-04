import { createRequire } from 'node:module';

import { cjsOutput, entryPoint, esmOutput, plugins, tsDeclarationOutput } from '../rollup.config.parts';

const rq = createRequire(import.meta.url);
const pkg = rq('./package.json');

export default [
  {
    input: entryPoint,
    plugins,
    output: [cjsOutput(pkg), esmOutput(pkg, 'grafana-runtime')],
    treeshake: false,
  },
  {
    input: 'src/unstable.ts',
    plugins,
    output: [cjsOutput(pkg), esmOutput(pkg, 'grafana-runtime')],
    treeshake: false,
  },
  tsDeclarationOutput(pkg),
  tsDeclarationOutput(pkg, {
    input: './compiled/unstable.d.ts',
    output: [
      {
        file: './dist/cjs/unstable.d.cts',
        format: 'cjs',
      },
      {
        file: './dist/esm/unstable.d.mts',
        format: 'es',
      },
    ],
  }),
];
