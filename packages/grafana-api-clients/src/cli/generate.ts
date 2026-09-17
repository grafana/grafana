/**
 * grafana-api-clients generate --spec <dir> --out <dir>
 *
 * Turns the OpenAPI documents an app plugin's API server serves (as written by
 * `grafana cli write-openapi`) into RTK Query clients, one per group version, using the
 * same simplification and codegen that produce the clients in this package.
 *
 *   <out>/createBaseQuery.ts         shared base query over getBackendSrv()
 *   <out>/<version>/baseAPI.ts       createApi() the endpoints are injected into
 *   <out>/<version>/endpoints.gen.ts generated endpoints, types and hooks
 *   <out>/<version>/index.ts         re-exports, generatedAPI
 *
 * baseAPI.ts and index.ts are written once and left alone afterwards, so they can be
 * customized; endpoints.gen.ts is regenerated every run.
 */
import { generateEndpoints } from '@rtk-query/codegen-openapi';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { type OpenAPIV3 } from 'openapi-types';

import { groupVersion, includeEndpoint } from './lib.ts';
import { processOpenAPISpec } from './process-spec.ts';
import { renderPluginBaseAPI, renderPluginIndexTs, CREATE_BASE_QUERY_SOURCE } from './templates.ts';

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

const specDir = path.resolve(values.spec);
const outDir = path.resolve(values.out);

function writeIfMissing(file: string, content: string) {
  if (!existsSync(file)) {
    writeFileSync(file, content);
    console.log(`Wrote ${path.relative(process.cwd(), file)}`);
  }
}

mkdirSync(outDir, { recursive: true });
writeIfMissing(path.join(outDir, 'createBaseQuery.ts'), CREATE_BASE_QUERY_SOURCE);

const files = readdirSync(specDir).filter((f) => f.endsWith('.json'));
if (files.length === 0) {
  console.error(`No OpenAPI documents in ${specDir}`);
  process.exit(1);
}

for (const file of files) {
  const raw: OpenAPIV3.Document = JSON.parse(readFileSync(path.join(specDir, file), 'utf8'));
  const { group, version } = groupVersion(raw, file);
  const spec = processOpenAPISpec(raw);

  const dir = path.join(outDir, version);
  mkdirSync(dir, { recursive: true });
  const processedFile = path.join(dir, 'openapi.processed.json');
  writeFileSync(processedFile, JSON.stringify(spec, null, 2));

  const apiFile = path.join(dir, 'baseAPI.ts');
  writeIfMissing(apiFile, renderPluginBaseAPI(group, version));
  writeIfMissing(path.join(dir, 'index.ts'), renderPluginIndexTs());

  const outputFile = path.join(dir, 'endpoints.gen.ts');
  await generateEndpoints({
    schemaFile: processedFile,
    apiFile,
    outputFile,
    exportName: 'generatedAPI',
    tag: true,
    hooks: { queries: true, lazyQueries: true, mutations: true },
    filterEndpoints: (_name, operation) => includeEndpoint(operation.path),
  });
  console.log(`Wrote ${path.relative(process.cwd(), outputFile)} for ${group}/${version}`);
}
