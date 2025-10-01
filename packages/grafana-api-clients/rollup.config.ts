import { createRequire } from 'node:module';
import svg from 'rollup-plugin-svg-import';

import { cjsOutput, entryPoint, esmOutput, plugins } from '../rollup.config.parts';

const rq = createRequire(import.meta.url);
const pkg = rq('./package.json');

const apiClients = Object.entries<{ import: string; require: string }>(pkg.exports).filter(
  ([key]) => key !== './package.json' && key.startsWith('./')
);

export default [
  {
    input: entryPoint,
    plugins: [
      ...plugins,
      // why do we need to care about grafana/ui logic?
      svg({ stringify: true }),
    ],
    output: [cjsOutput(pkg), esmOutput(pkg, 'grafana-api-clients')],
    treeshake: 'safest',
  },
  ...apiClients.map(([_, { import: importPath }]) => ({
    input: importPath,
    plugins,
    output: [cjsOutput(pkg), esmOutput(pkg, 'grafana-api-clients')],
    treeshake: true,
  })),
];
