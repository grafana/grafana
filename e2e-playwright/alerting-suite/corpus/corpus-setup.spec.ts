import { test } from '@playwright/test';

import { getNamespace } from '../ruleSeeding';

import { writeCorpusManifest } from './corpusState';
import { seedCorpus } from './seedCorpus';

// Setup project, not `beforeAll`, which would seed once per worker.
test('seed the shared Alert/Recording rule corpus', async ({ request }) => {
  const namespace = await getNamespace(request);
  const manifest = await seedCorpus(request, namespace);
  writeCorpusManifest(manifest);

  // eslint-disable-next-line no-console -- surfaces setup cost in the run log.
  console.log(
    `[gma-corpus] seeded 120 Alert + 120 Recording rules across ${manifest.folders.length} folders (run ${manifest.runMarker}) in ${manifest.setupDurationMs}ms`
  );
});
