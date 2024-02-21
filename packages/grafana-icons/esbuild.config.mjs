import * as esbuild from 'esbuild';
import path from 'path';
import pkg from './package.json' assert { type: 'json' };

await esbuild.build({
  entryPoints: ['src/index.js'],
  bundle: true,
  format: 'esm',
  sourcemap: true,
  outdir: path.dirname(pkg.publishConfig.module),
  loader: { '.js': 'jsx' },
});
