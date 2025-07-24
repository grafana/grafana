import { glob } from 'glob';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'path';
import copy from 'rollup-plugin-copy';

import { cjsOutput, entryPoint, esmOutput, plugins } from '../rollup.config.parts';

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
  {
    input: Object.fromEntries(
      glob
        .sync('src/raw/composable/**/*.ts')
        .map((file) => [
          path.relative('src', file.slice(0, file.length - path.extname(file).length)),
          fileURLToPath(new URL(file, import.meta.url)),
        ])
    ),
    plugins: [
      noderesolve,
      esbuild,
      // Support @grafana/scenes that pulls in types from nested @grafana/schema files.
      copy({
        targets: [
          {
            src: 'dist/types/raw/composable/**/*.d.ts',
            dest: 'dist/esm/raw/composable',
            rename: (_name, _extension, fullpath) => fullpath.split(path.sep).slice(4).join('/'),
          },
        ],
        hook: 'writeBundle',
      }),
    ],
    output: {
      format: 'esm',
      dir: path.dirname(pkg.publishConfig.module),
    },
    treeshake: false,
  },
];
