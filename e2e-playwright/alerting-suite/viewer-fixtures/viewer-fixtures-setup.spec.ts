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

const VIEWER_LOGIN = 'alerting-viewer';
const VIEWER_PASSWORD = 'password';

// Created fresh: the grant needs its id before login. A leftover user is deleted since permissions cache per user.
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

// API, not file provisioning, which would disable actions for non-role reasons.
test('seed the folder and rules the Viewer reads', async ({ request }) => {
  const namespace = await getNamespace(request);
  const run = newRunMarker();
  const folderUid = `e2e-viewer-${run}`;
  const folderTitle = `Viewer visible ${run}`;
  const alertTitle = `Checkout latency high ${run}`;
  const recordingTitle = `Checkout latency p99 ${run}`;

  const viewerId = await createViewerUser(request);
  await createFolderAndWait(request, namespace, folderUid, folderTitle);
  // The 60 s basic-role cache hides a new folder's default Viewer grant; a grant to this user is read from the DB at once.
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
