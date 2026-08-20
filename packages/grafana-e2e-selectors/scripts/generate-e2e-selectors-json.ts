import { writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { versionedComponents } from '../src/selectors/components';
import { versionedPages } from '../src/selectors/pages';

import { serializeSelectorGroup } from './serialize-selectors';

// Generates the data-only selector file served at /public/e2e-selectors.json. @grafana/plugin-e2e
// fetches this at test runtime and reconstructs it into selectors without executing fetched code.
// See design doc: Plugin E2E Selectors.

const SCHEMA_VERSION = 1;

const output = {
  schemaVersion: SCHEMA_VERSION,
  versionedComponents: serializeSelectorGroup(versionedComponents),
  versionedPages: serializeSelectorGroup(versionedPages),
};

// resolved from import.meta.url rather than __dirname so it works whether this script runs as CJS or
// ESM (this package is CommonJS today, but tsx and a future ESM migration both need this form)
const scriptDir = dirname(fileURLToPath(import.meta.url));
const outFile = resolve(scriptDir, '../../../public/e2e-selectors.json');
writeFileSync(outFile, JSON.stringify(output), 'utf8');

// eslint-disable-next-line no-console
console.log(`Wrote e2e selectors to ${outFile}`);
