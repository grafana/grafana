import { writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { versionedComponents } from '../src/selectors/components';
import { versionedPages } from '../src/selectors/pages';

import { serializeSelectorGroup } from './serialize-selectors';

// Serializes the versioned selector tree into the data-only JSON string that @grafana/plugin-e2e
// fetches at test runtime and reconstructs without executing fetched code. Exported so the frontend
// build (webpack/rspack) can emit it as an asset in-process. See design doc: Plugin E2E Selectors.

const SCHEMA_VERSION = 1;

export function generateE2ESelectorsJson(): string {
  return JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    versionedComponents: serializeSelectorGroup(versionedComponents),
    versionedPages: serializeSelectorGroup(versionedPages),
  });
}

// when run directly (yarn generate-e2e-selectors-json) emit the JSON; importing this module does not.
// --stdout prints the JSON so the frontend build can capture and emit it as an asset; otherwise write
// the file for standalone/manual use.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const json = generateE2ESelectorsJson();
  if (process.argv.includes('--stdout')) {
    process.stdout.write(json);
  } else {
    const outFile = resolve(dirname(fileURLToPath(import.meta.url)), '../../../public/e2e-selectors.json');
    writeFileSync(outFile, json, 'utf8');
    // eslint-disable-next-line no-console
    console.log(`Wrote e2e selectors to ${outFile}`);
  }
}
