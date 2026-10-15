import { type APIRequestContext, test } from '@playwright/test';

import { expect } from '@grafana/plugin-e2e';

import { waitForRuleSearchVisible } from '../fixtures';
import {
  RUN_LABEL,
  createAlertRule,
  createFolderAndWait,
  createRecordingRule,
  getNamespace,
  newRunMarker,
} from '../ruleSeeding';

import { deleteUser } from './deleteUser';
import { writeViewerFixtures } from './viewerFixtureState';

// Must match the user of the `alerting-viewer-login` project in playwright.config.ts.
const VIEWER_LOGIN = 'alerting-viewer';
const VIEWER_PASSWORD = 'password';

// Creates the Viewer from scratch, the way the plugin-e2e auth setup does, because the grant below needs
// its id before that project's login has run. A user left over from an earlier run is deleted first: the
// authorization layers keep a short-lived cache per user, and a user that already made requests keeps
// answering with its old permissions for several seconds after a grant, which a new user never does.
async function createViewerUser(request: APIRequestContext): Promise<number> {
  const existing = await request.get(`/api/users/lookup?loginOrEmail=${VIEWER_LOGIN}`);
  if (existing.ok()) {
    await deleteUser(request, (await existing.json()).id);
  }
  const created = await request.post('/api/admin/users', {
    data: { name: VIEWER_LOGIN, login: VIEWER_LOGIN, password: VIEWER_PASSWORD },
  });
  expect(created.ok(), `POST /api/admin/users -> ${created.status()} ${await created.text()}`).toBeTruthy();
  const userId: number = (await created.json()).id;
  const role = await request.patch(`/api/org/users/${userId}`, { data: { role: 'Viewer' } });
  expect(role.ok(), `PATCH /api/org/users/${userId} -> ${await role.text()}`).toBeTruthy();
  return userId;
}

// A setup project that the Viewer's login depends on, not something the Viewer spec creates itself.
// The rules are created through the API, not file provisioning, because provisioned rules disable
// their actions for a reason other than the role.
test('seed the folder and rules the Viewer reads', async ({ request }) => {
  const namespace = await getNamespace(request);
  const run = newRunMarker();
  const folderUid = `e2e-viewer-${run}`;
  const folderTitle = `Viewer visible ${run}`;
  const alertTitle = `Checkout latency high ${run}`;
  const recordingTitle = `Checkout latency p99 ${run}`;

  const viewerId = await createViewerUser(request);
  await createFolderAndWait(request, namespace, folderUid, folderTitle);
  // Grafana caches a basic role's permissions for 60 s in one entry shared by every user of that role,
  // so a new folder's default Viewer grant stays invisible to the Viewer until that entry refreshes. A
  // grant to this user itself is read from the database when the new user first asks, which makes the
  // folder readable at once. This endpoint adds one permission and leaves the folder's others in place.
  const grant = await request.post(`/api/access-control/folders/${folderUid}/users/${viewerId}`, {
    data: { permission: 'View' },
  });
  expect(grant.ok(), `POST folder permission for the Viewer -> ${grant.status()} ${await grant.text()}`).toBeTruthy();

  const alertUid = await createAlertRule(request, namespace, folderUid, {
    title: alertTitle,
    labels: { [RUN_LABEL]: run },
  });
  const recordingUid = await createRecordingRule(request, namespace, folderUid, {
    title: recordingTitle,
    metric: `checkout_latency_p99_${run}`,
    labels: { [RUN_LABEL]: run },
  });
  await waitForRuleSearchVisible(request, namespace, 'alertrules', folderUid, 1);
  await waitForRuleSearchVisible(request, namespace, 'recordingrules', folderUid, 1);

  writeViewerFixtures({
    runMarker: run,
    viewerUserId: viewerId,
    folderUid,
    folderTitle,
    alertRule: { uid: alertUid, title: alertTitle },
    recordingRule: { uid: recordingUid, title: recordingTitle },
  });
});
