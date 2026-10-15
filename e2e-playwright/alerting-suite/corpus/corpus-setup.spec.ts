import { test } from '@playwright/test';

import { getNamespace } from '../ruleSeeding';

import { writeCorpusManifest } from './corpusState';
import { seedCorpus } from './seedCorpus';

// Runs once as a setup-project dependency (see playwright.config.ts `alerting-corpus-setup`),
// not `beforeAll` — `beforeAll` runs once per worker under `fullyParallel`, which would seed
// the corpus multiple times. Read-only browsing/filter/pagination specs depend on this project
// and read the manifest it writes; `corpus-teardown.spec.ts` deletes everything afterwards.
test('seed the shared Alert/Recording rule corpus', async ({ request }) => {
  const namespace = await getNamespace(request);
  const manifest = await seedCorpus(request, namespace);
  writeCorpusManifest(manifest);

  // eslint-disable-next-line no-console -- intentional: surfaces setup cost in the run log.
  console.log(
    `[gma-corpus] seeded 120 Alert + 120 Recording rules across ${manifest.folders.length} folders (run ${manifest.runMarker}) in ${manifest.setupDurationMs}ms`
  );
});
