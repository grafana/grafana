import { glob } from 'glob';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'path';

import { cjsOutput, entryPoint, esmOutput, plugins, tsDeclarationOutput } from '../rollup.config.parts';

const rq = createRequire(import.meta.url);
const pkg = rq('./package.json');

const [_, noderesolve, esbuild] = plugins;

export default [
  {
    input: entryPoint,
    plugins,
    output: [cjsOutput(pkg), esmOutput(pkg, 'grafana-schema')],
    treeshake: false,
  },
  tsDeclarationOutput(pkg, { input: './dist/esm/index.d.ts' }),
  {
    input: Object.fromEntries(
      glob
        .sync('src/raw/composable/**/*.ts')
        .map((file) => [
          path.relative('src', file.slice(0, file.length - path.extname(file).length)),
          fileURLToPath(new URL(file, import.meta.url)),
        ])
    ),
    plugins: [noderesolve, esbuild],
    output: {
      format: 'esm',
      dir: path.dirname(pkg.publishConfig.module),
    },
    treeshake: false,
  },
];
