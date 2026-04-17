import { glob } from 'glob';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'path';
import copy from 'rollup-plugin-copy';

import { cjsOutput, entryPoint, esmOutput, plugins } from '../rollup.config.parts';

const rq = createRequire(import.meta.url);
const pkg = rq('./package.json');
const typePaths = backwardsCompatibilityTypeNames();

export default [
  {
    input: entryPoint,
    plugins,
    output: [cjsOutput(pkg, 'grafana-schema'), esmOutput(pkg, 'grafana-schema')],
    treeshake: false,
  },
  {
    // Files that should be exported but not included in the `entryPoint`.
    input: Object.fromEntries(
      glob
        .sync('src/raw/composable/**/*.ts')
        .map((file) => [
          path.relative('src', file.slice(0, file.length - path.extname(file).length)),
          fileURLToPath(new URL(file, import.meta.url)),
        ])
    ),
    plugins: [
      ...plugins,
      copy({
        targets: [
          {
            src: 'dist/types/raw/composable/**/*.d.ts',
            dest: 'dist/esm/raw/composable',
            rename: (_name, _extension, fullpath) => {
              const typePath = typePaths[fullpath] || fullpath;
              return typePath.split(path.sep).slice(4).join('/');
            },
          },
        ],
        hook: 'writeBundle',
      }),
    ],
    output: [
      {
        format: 'esm',
        dir: path.dirname(pkg.module),
        entryFileNames: '[name].mjs',
      },
      {
        format: 'cjs',
        dir: path.dirname(pkg.main),
        entryFileNames: '[name].cjs',
      },
    ],
    treeshake: false,
  },
];

function backwardsCompatibilityTypeNames(): Record<string, string> {
  return Object.keys(pkg.exports).reduce<Record<string, string>>((map, key) => {
    const typesPath = pkg.exports[key].types;
    if (!typesPath) {
      return map;
    }
    map[path.normalize(typesPath)] = `${path.normalize(key)}.d.ts`;
    return map;
  }, {});
}
