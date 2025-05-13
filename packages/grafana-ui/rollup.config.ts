import { createRequire } from 'node:module';
import copy from 'rollup-plugin-copy';
import svg from 'rollup-plugin-svg-import';

import { cjsOutput, entryPoint, esmOutput, plugins, tsDeclarationOutput } from '../rollup.config.parts';

const rq = createRequire(import.meta.url);
const icons = rq('../../public/app/core/icons/cached.json');
const pkg = rq('./package.json');

const iconSrcPaths = icons.map((iconSubPath) => {
  // eslint-disable-next-line @grafana/no-restricted-img-srcs
  return `../../public/img/icons/${iconSubPath}.svg`;
});

export default [
  {
    input: entryPoint,
    plugins: [
      ...plugins,
      svg({ stringify: true }),
      copy({
        targets: [{ src: iconSrcPaths, dest: './dist/public/' }],
        flatten: false,
      }),
    ],
    output: [cjsOutput(pkg), esmOutput(pkg, 'grafana-ui')],
  },
  {
    input: 'src/unstable.ts',
    plugins: [
      ...plugins,
      svg({ stringify: true }),
      copy({
        targets: [{ src: iconSrcPaths, dest: './dist/public/' }],
        flatten: false,
      }),
    ],
    output: [cjsOutput(pkg), esmOutput(pkg, 'grafana-ui')],
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
