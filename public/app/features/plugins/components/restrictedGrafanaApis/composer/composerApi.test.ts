import { locationService } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { appEvents } from 'app/core/app_events';
import { requestComposerEnter } from 'app/features/dashboard-scene/composer/composerEntryRequests';
import { DashboardMutationClient } from 'app/features/dashboard-scene/mutation-api/DashboardMutationClient';
import { transformSaveModelToScene } from 'app/features/dashboard-scene/serialization/transformSaveModelToScene';
import { SetExtensionSidebarPresentationEvent } from 'app/types/events';

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

function mountDashboard() {
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
  return scene;
}

const DASHBOARD = { resource: 'dashboard', uid: 'composer-api-test' } as const;

it('refuses when no document is mounted', async () => {
  expect(composerApi.version).toBe(1);
  expect(composerApi.canEnter()).toEqual({ ok: false, reason: 'no_document' });
  expect(composerApi.canEnter(DASHBOARD)).toEqual({ ok: false, reason: 'no_document' });
  await expect(composerApi.enter(DASHBOARD)).rejects.toThrow('no_document');
});

it('enters the mounted dashboard, by target or by default, once', async () => {
  const scene = mountDashboard();

  expect(composerApi.canEnter()).toEqual({ ok: true });
  expect(composerApi.canEnter(DASHBOARD)).toEqual({ ok: true });
  const session = await composerApi.enter(DASHBOARD);
  expect(session.target).toEqual(DASHBOARD);
  expect(scene.getComposerSession()).toBe(session);
  await expect(composerApi.enter()).rejects.toThrow('unsupported');
  session.exit();

  const byDefault = await composerApi.enter();
  expect(byDefault.target).toEqual(DASHBOARD);
  byDefault.exit();
});

it('refuses a dashboard that is not the mounted one', async () => {
  mountDashboard();
  const other = { resource: 'dashboard', uid: 'another-dashboard' } as const;
  expect(composerApi.canEnter(other)).toEqual({ ok: false, reason: 'no_document' });
  await expect(composerApi.enter(other)).rejects.toThrow('no_document');
});

it('does not support notebooks yet', async () => {
  mountDashboard();
  const notebook = { resource: 'notebook', uid: 'composer-api-test' } as const;
  expect(composerApi.canEnter(notebook)).toEqual({ ok: false, reason: 'unsupported' });
  await expect(composerApi.enter(notebook)).rejects.toThrow('unsupported');
});

describe('presentation', () => {
  const presentations: string[] = [];
  let unsubscribe = () => {};

  beforeEach(() => {
    presentations.length = 0;
    const subscription = appEvents.subscribe(SetExtensionSidebarPresentationEvent, ({ payload }) =>
      presentations.push(payload.presentation)
    );
    unsubscribe = () => subscription.unsubscribe();
  });

  afterEach(() => unsubscribe());

  it('floats the extension sidebar for the session by default and docks it when the session ends', async () => {
    mountDashboard();
    const session = await composerApi.enter(DASHBOARD);
    expect(presentations).toEqual(['floating']);
    session.exit();
    expect(presentations).toEqual(['floating', 'docked']);
  });

  it("never touches the extension sidebar with presentation 'none'", async () => {
    mountDashboard();
    const session = await composerApi.enter(DASHBOARD, { presentation: 'none' });
    session.exit();
    expect(presentations).toEqual([]);
  });
});

it('passes entry requests from Grafana to the registered listeners until they unsubscribe', () => {
  const listener = jest.fn();
  const unsubscribe = composerApi.onEnterRequested(listener);
  requestComposerEnter(DASHBOARD);
  expect(listener).toHaveBeenCalledWith(DASHBOARD);

  unsubscribe();
  requestComposerEnter(DASHBOARD);
  expect(listener).toHaveBeenCalledTimes(1);
});
