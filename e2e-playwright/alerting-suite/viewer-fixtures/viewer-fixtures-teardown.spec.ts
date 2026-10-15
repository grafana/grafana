import { test } from '@playwright/test';

import { deleteFolder } from '../ruleSeeding';

import { deleteUser } from './deleteUser';
import { clearViewerFixtures, readViewerFixtures } from './viewerFixtureState';

test('remove the folder, rules and user the Viewer read with', async ({ request }) => {
  const fixtures = readViewerFixtures();
  if (!fixtures) {
    return;
  }

  await deleteFolder(request, fixtures.folderUid);
  await deleteUser(request, fixtures.viewerUserId);
  clearViewerFixtures();
});
