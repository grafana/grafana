import { generateEndpoints } from '@rtk-query/codegen-openapi';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type OpenAPIV3 } from 'openapi-types';

import { groupVersion, includeEndpoint } from './lib.ts';
import { processOpenAPISpec } from './process-spec.ts';
import { CREATE_BASE_QUERY_SOURCE, renderPluginBaseAPI, renderPluginIndexTs } from './templates.ts';

export interface GenerateOptions {
  /** Directory of <group>-<version>.json OpenAPI documents, as written by `grafana cli write-openapi`. */
  specDir: string;
  /** Directory to write the clients to. */
  outDir: string;
  log?: (message: string) => void;
}

/**
 * Turns every OpenAPI document in specDir into an RTK Query client under outDir/<version>/.
 * baseAPI.ts, index.ts and the shared createBaseQuery.ts are written once and left alone afterwards;
 * endpoints.gen.ts is regenerated every run.
 */
export async function generateClients({ specDir, outDir, log = console.log }: GenerateOptions): Promise<void> {
  specDir = path.resolve(specDir);
  outDir = path.resolve(outDir);

  const writeIfMissing = (file: string, content: string) => {
    if (!existsSync(file)) {
      writeFileSync(file, content);
      log(`Wrote ${path.relative(process.cwd(), file)}`);
    }
  };

  const files = readdirSync(specDir)
    .filter((f) => f.endsWith('.json'))
    .sort();
  if (files.length === 0) {
    throw new Error(`No OpenAPI documents in ${specDir}`);
  }

  mkdirSync(outDir, { recursive: true });
  writeIfMissing(path.join(outDir, 'createBaseQuery.ts'), CREATE_BASE_QUERY_SOURCE);

  // The simplified spec is only read by the codegen. Core keeps its own under packages/grafana-openapi
  // because its pipeline hands the file between two workspaces; here both steps run in one process.
  const tmp = mkdtempSync(path.join(tmpdir(), 'grafana-api-clients-'));
  try {
    await generateAll(files, { specDir, outDir, tmp, writeIfMissing, log });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function generateAll(
  files: string[],
  {
    specDir,
    outDir,
    tmp,
    writeIfMissing,
    log,
  }: {
    specDir: string;
    outDir: string;
    tmp: string;
    writeIfMissing: (file: string, content: string) => void;
    log: (message: string) => void;
  }
) {
  for (const file of files) {
    const raw: OpenAPIV3.Document = JSON.parse(readFileSync(path.join(specDir, file), 'utf8'));
    const { group, version } = groupVersion(raw, file);
    const spec = processOpenAPISpec(raw);

    const dir = path.join(outDir, version);
    mkdirSync(dir, { recursive: true });
    const processedFile = path.join(tmp, `${version}.json`);
    writeFileSync(processedFile, JSON.stringify(spec));

    const apiFile = path.join(dir, 'baseAPI.ts');
    writeIfMissing(apiFile, renderPluginBaseAPI(group, version));
    writeIfMissing(path.join(dir, 'index.ts'), renderPluginIndexTs());

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
    log(`Wrote ${path.relative(process.cwd(), outputFile)} for ${group}/${version}`);
  }
}
