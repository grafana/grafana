import resolve from '@rollup/plugin-node-resolve';
import { glob } from 'glob';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'path';
import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';
import { nodeExternals } from 'rollup-plugin-node-externals';

const rq = createRequire(import.meta.url);
const pkg = rq('./package.json');

const legacyOutputDefaults = {
  esModule: true,
  interop: 'compat',
};

export default [
  {
    input: 'src/index.ts',
    plugins: [
      nodeExternals({ deps: true, packagePath: './package.json' }),
      resolve(),
      esbuild({
        target: 'es2018',
        tsconfig: 'tsconfig.build.json',
      }),
    ],
    output: [
      {
        format: 'cjs',
        sourcemap: true,
        dir: path.dirname(pkg.publishConfig.main),
        ...legacyOutputDefaults,
      },
      {
        format: 'esm',
        sourcemap: true,
        dir: path.dirname(pkg.publishConfig.module),
        preserveModules: true,
        // @ts-expect-error (TS cannot assure that `process.env.PROJECT_CWD` is a string)
        preserveModulesRoot: path.join(process.env.PROJECT_CWD, `packages/grafana-schema/src`),
        ...legacyOutputDefaults,
      },
    ],
  },
  {
    input: './dist/esm/index.d.ts',
    plugins: [dts()],
    output: {
      file: pkg.publishConfig.types,
      format: 'es',
    },
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
      resolve(),
      esbuild({
        target: 'es2018',
        tsconfig: 'tsconfig.build.json',
      }),
    ],
    output: {
      format: 'esm',
      dir: path.dirname(pkg.publishConfig.module),
    },
  },
];
