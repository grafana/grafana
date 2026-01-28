import { glob } from 'glob';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'path';

import { cjsOutput, entryPoint, esmOutput, plugins } from '../rollup.config.parts';

const rq = createRequire(import.meta.url);
const pkg = rq('./package.json');

export default [
  {
    input: entryPoint,
    plugins,
    output: [cjsOutput(pkg, 'grafana-schema'), esmOutput(pkg, 'grafana-schema')],
    treeshake: false,
  },
  {
    // TODO: replace by adding these entries as exported to the `index.gen.ts` files
    input: Object.fromEntries(
      glob
        .sync('src/raw/composable/**/*.ts')
        .map((file) => [
          path.relative('src', file.slice(0, file.length - path.extname(file).length)),
          fileURLToPath(new URL(file, import.meta.url)),
        ])
    ),
    plugins,
    output: [cjsOutput(pkg, 'grafana-schema'), esmOutput(pkg, 'grafana-schema')],
    treeshake: false,
  },
];
