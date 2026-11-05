// Emits resources.gen.ts next to each generated client's endpoints.gen.ts, so consumers can name a
// resource by its kind instead of hardcoding the plural. Run as part of `pnpm generate-apis`.
import fs from 'fs';
import path from 'path';

import { renderResourceNames, resourceNamesFromSpec } from './resource-names.ts';

const RESOURCES_FILE = 'resources.gen.ts';
const INDEX_EXPORT = `export { API_RESOURCES } from './resources.gen';`;

const basePath = path.resolve(import.meta.dirname, '../../../..');
const clientsDir = path.resolve(import.meta.dirname, '../clients/rtkq');
const specsDir = path.join(basePath, 'packages/grafana-openapi/src/apis');

/** The `<group>/<version>` client directories, as `createAPIConfig` lays them out. */
function apiserverClientDirs(): Array<{ dir: string; group: string; version: string }> {
  return (
    fs
      .readdirSync(clientsDir, { withFileTypes: true, recursive: true })
      .filter((entry) => entry.isFile() && entry.name === 'baseAPI.ts')
      // Clients of the legacy (non-apiserver) APIs declare no group, and have no kinds to name.
      .filter((entry) => fs.readFileSync(path.join(entry.parentPath, entry.name), 'utf8').includes('const API_GROUP'))
      .map((entry) => {
        const [group, version] = path.relative(clientsDir, entry.parentPath).split(path.sep);
        return { dir: entry.parentPath, group, version };
      })
  );
}

function writeIfChanged(filePath: string, contents: string) {
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === contents) {
    return;
  }
  fs.writeFileSync(filePath, contents, 'utf8');
  console.log(`Wrote ${path.relative(basePath, filePath)}`);
}

/** Adds the re-export to a client scaffolded before this step existed. */
function ensureIndexExport(clientDir: string) {
  const indexFile = path.join(clientDir, 'index.ts');
  const content = fs.readFileSync(indexFile, 'utf8');
  if (content.includes(INDEX_EXPORT)) {
    return;
  }
  const lines = content.split('\n');
  const baseAPIExport = lines.findIndex((line) => line.includes(`from './baseAPI'`));
  lines.splice(baseAPIExport + 1, 0, INDEX_EXPORT);
  fs.writeFileSync(indexFile, lines.join('\n'), 'utf8');
  console.log(`Added the resources export to ${path.relative(basePath, indexFile)}`);
}

for (const { dir, group, version } of apiserverClientDirs()) {
  const specFile = path.join(specsDir, `${group}.grafana.app-${version}.json`);
  if (!fs.existsSync(specFile)) {
    console.warn(`No processed spec at ${path.relative(basePath, specFile)}; skipping ${RESOURCES_FILE} for ${dir}`);
    continue;
  }

  const names = resourceNamesFromSpec(JSON.parse(fs.readFileSync(specFile, 'utf8')));
  // A group version serving only subresources or custom routes (e.g. query, search) names no kinds.
  if (Object.keys(names).length === 0) {
    continue;
  }

  writeIfChanged(path.join(dir, RESOURCES_FILE), renderResourceNames(names));
  ensureIndexExport(dir);
}
