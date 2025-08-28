import { createRequire } from 'node:module';

import { cjsOutput, entryPoint, esmOutput, plugins } from '../rollup.config.parts';

const rq = createRequire(import.meta.url);
const pkg = rq('./package.json');

export default [
  {
    input: entryPoint,
    plugins,
    external: ['@grafana/scenes', 'react-router-dom', 'react-router'],
    output: [cjsOutput(pkg), esmOutput(pkg, 'grafana-alerting')],
    treeshake: false,
  },
  {
    input: 'src/unstable.ts',
    plugins,
    external: ['@grafana/scenes', 'react-router-dom', 'react-router'],
    output: [cjsOutput(pkg), esmOutput(pkg, 'grafana-alerting')],
    treeshake: false,
  },
  {
    input: 'src/testing.ts',
    plugins,
    external: ['@grafana/scenes', 'react-router-dom', 'react-router'],
    output: [cjsOutput(pkg), esmOutput(pkg, 'grafana-alerting')],
  },
];
