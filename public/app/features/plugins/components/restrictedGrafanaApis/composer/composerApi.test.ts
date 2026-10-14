import { locationService } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { DashboardMutationClient } from 'app/features/dashboard-scene/mutation-api/DashboardMutationClient';
import { transformSaveModelToScene } from 'app/features/dashboard-scene/serialization/transformSaveModelToScene';

import { setDashboardMutationClientForTests } from '../dashboardMutation/dashboardMutationApi';

import { composerApi } from './composerApi';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('app/features/dashboard-scene/saving/createDetectChangesWorker', () => ({
  createWorker: () => ({ postMessage: jest.fn(), terminate: jest.fn(), onmessage: null }),
}));

let deactivate = () => {};

beforeEach(() => {
  setTestFlags({ dashboardNewLayouts: true, 'grafana.dashboardPreviewMode': true, 'grafana.dashboardComposer': true });
  locationService.replace('/d/composer-api-test');
});

afterEach(() => {
  setDashboardMutationClientForTests(null);
  deactivate();
  deactivate = () => {};
  setTestFlags({});
});

it('enters Composer on the mounted dashboard only', async () => {
  expect(composerApi.version).toBe(1);
  expect(composerApi.canEnter()).toEqual({ ok: false, reason: 'not_dashboard' });

  const scene = transformSaveModelToScene({
    dashboard: {
      title: 'API',
      uid: 'composer-api-test',
      version: 1,
      schemaVersion: 39,
      panels: [],
      annotations: {
        list: [
          {
            builtIn: 1,
            iconColor: 'rgba(0, 211, 255, 1)',
            enable: false,
            hide: true,
            name: 'Annotations & Alerts',
            type: 'dashboard',
            datasource: { uid: '-- Grafana --', type: 'grafana' },
          },
        ],
      },
    },
    meta: { canEdit: true, canSave: true },
  });
  deactivate = scene.activate();
  setDashboardMutationClientForTests(new DashboardMutationClient(scene));

  expect(composerApi.canEnter()).toEqual({ ok: true });
  const session = await composerApi.enter();
  expect(session.dashboardUid).toBe('composer-api-test');
  expect(scene.getComposerSession()).toBe(session);
  await expect(composerApi.enter()).rejects.toThrow('unsupported');
  session.exit();
});
