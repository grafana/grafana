import { createRequire } from 'node:module';
import copy from 'rollup-plugin-copy';
import svg from 'rollup-plugin-svg-import';

import { cjsOutput, entryPoint, esmOutput, plugins } from '../rollup.config.parts';

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
    treeshake: false,
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
    treeshake: false,
  },
];
