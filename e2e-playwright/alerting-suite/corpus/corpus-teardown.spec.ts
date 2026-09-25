import { test } from '@playwright/test';

import { clearCorpusManifest, readCorpusManifest } from './corpusState';
import { teardownCorpus } from './seedCorpus';

test('remove the shared Alert/Recording rule corpus', async ({ request }) => {
  const manifest = readCorpusManifest();
  if (!manifest) {
    return;
  }

  await teardownCorpus(request, manifest);
  clearCorpusManifest();
});
