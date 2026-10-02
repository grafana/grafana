import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type OpenAPIV3 } from 'openapi-types';

import { processOpenAPISpec, specGroupVersion } from '@grafana/openapi/internal/process-spec';

import { writeNewFileIfMissing } from '../generator/files.ts';
import { deriveReducerPath, renderBaseAPI, renderIndexTs } from '../generator/templates.ts';

import { includeEndpoint } from './lib.ts';

const BASE_API_IMPORTS = `import { createBaseQuery, getAPIBaseURL } from '@grafana/api-clients';`;

export interface GenerateOptions {
  /** Directory of <group>-<version>.json OpenAPI documents, as written by `grafana cli write-openapi`. */
  specDir: string;
  /** Directory to write the clients to. */
  outDir: string;
}

/**
 * Turns every OpenAPI document in specDir into an RTK Query client under outDir/<version>/.
 * baseAPI.ts and index.ts are written once and left alone afterwards; endpoints.gen.ts is
 * regenerated every run.
 */
export async function generateClients({ specDir, outDir }: GenerateOptions): Promise<void> {
  specDir = path.resolve(specDir);
  outDir = path.resolve(outDir);

  const files = readdirSync(specDir)
    .filter((f) => f.endsWith('.json'))
    .sort();
  if (files.length === 0) {
    throw new Error(`No OpenAPI documents in ${specDir}`);
  }

  const { generateEndpoints } = await importCodegen();

  // The simplified spec is only read by the codegen. Core keeps its own under packages/grafana-openapi
  // because its pipeline hands the file between two workspaces; here both steps run in one process.
  const tmp = mkdtempSync(path.join(tmpdir(), 'grafana-api-clients-'));
  try {
    for (const file of files) {
      const raw: OpenAPIV3.Document = JSON.parse(readFileSync(path.join(specDir, file), 'utf8'));
      const gv = specGroupVersion(raw);
      if (!gv) {
        throw new Error(`${file}: unable to determine group and version`);
      }
      const { group, version } = gv;

      const processedFile = path.join(tmp, `${version}.json`);
      writeFileSync(processedFile, JSON.stringify(processOpenAPISpec(raw)));

      const dir = path.join(outDir, version);
      const apiFile = path.join(dir, 'baseAPI.ts');
      const reducerPath = deriveReducerPath(group.replace(/\.grafana\.app$/, ''), version);
      writeNewFileIfMissing(apiFile, renderBaseAPI({ group, version, reducerPath }, BASE_API_IMPORTS));
      writeNewFileIfMissing(path.join(dir, 'index.ts'), renderIndexTs());

      // A relative apiFile (resolved against cwd) makes the codegen emit a relative import of baseAPI;
      // an absolute one would be emitted verbatim.
      const outputFile = path.join(dir, 'endpoints.gen.ts');
      await generateEndpoints({
        schemaFile: processedFile,
        apiFile: './' + path.relative(process.cwd(), apiFile),
        outputFile,
        exportName: 'generatedAPI',
        tag: true,
        hooks: { queries: true, lazyQueries: true, mutations: true },
        filterEndpoints: (_name, operation) => includeEndpoint(operation.path),
      });
      console.log(`Wrote ${path.relative(process.cwd(), outputFile)} for ${group}/${version}`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** The codegen is an optional peer dependency so plugins that only use the hooks do not install it. */
async function importCodegen() {
  try {
    return await import('@rtk-query/codegen-openapi');
  } catch {
    throw new Error('grafana-api-clients generate needs @rtk-query/codegen-openapi: yarn add -D @rtk-query/codegen-openapi');
  }
}
