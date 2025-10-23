import { createRequire } from 'node:module';

import { cjsOutput, entryPoint, esmOutput, plugins } from '../rollup.config.parts';

const rq = createRequire(import.meta.url);
const pkg = rq('./package.json');

const apiClients = Object.entries<{ import: string; require: string }>(pkg.exports).filter(([key]) =>
  key.startsWith('./rtkq/')
);

const apiClientConfigs = apiClients.map(([name, { import: importPath }]) => {
  const baseCjsOutput = cjsOutput(pkg);
  const entryFileNames = name.replace('./', '') + '.cjs';
  const cjsOutputConfig = { ...baseCjsOutput, entryFileNames };
  return {
    input: importPath.replace('./', ''),

    plugins,
    output: [cjsOutputConfig, esmOutput(pkg, 'grafana-api-clients')],
    treeshake: false,
  };
});

export default [
  {
    input: entryPoint,
    plugins,
    output: [cjsOutput(pkg), esmOutput(pkg, 'grafana-api-clients')],
    treeshake: false,
  },
  {
    input: 'src/clients/rtkq/index.ts',
    plugins,
    output: [cjsOutput(pkg), esmOutput(pkg, 'grafana-api-clients')],
    treeshake: false,
  },
  ...apiClientConfigs,
];
