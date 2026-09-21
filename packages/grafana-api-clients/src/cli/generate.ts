/**
 * grafana-api-clients generate --spec <dir> --out <dir>
 *
 * Turns the OpenAPI documents an app plugin's API server serves (as written by
 * `grafana cli write-openapi`) into RTK Query clients, one per group version, using the
 * same simplification and codegen that produce the clients in this package.
 *
 *   <out>/<version>/baseAPI.ts       createApi() the endpoints are injected into
 *   <out>/<version>/endpoints.gen.ts generated endpoints, types and hooks
 *   <out>/<version>/index.ts         re-exports, generatedAPI
 *
 * baseAPI.ts and index.ts are written once and left alone afterwards, so they can be
 * customized; endpoints.gen.ts is regenerated every run.
 */
import { parseArgs } from 'node:util';

import { generateClients } from './generateClients.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    spec: { type: 'string' },
    out: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (values.help || positionals[0] !== 'generate' || !values.spec || !values.out) {
  console.log(`Usage: grafana-api-clients generate --spec <dir> --out <dir>

  --spec  directory of <group>-<version>.json OpenAPI documents, as written by
          \`grafana cli write-openapi <manifest> -o <dir>\`
  --out   directory to write the clients to`);
  process.exit(values.help ? 0 : 1);
}

await generateClients({ specDir: values.spec, outDir: values.out });
