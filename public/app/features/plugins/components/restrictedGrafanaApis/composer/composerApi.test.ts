import { locationService } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
import {
  getEffectiveExtensionSidebarPresentation,
  notifyExtensionSidebarClosed,
  resetExtensionSidebarPresentationForTests,
  setExtensionSidebarPresentation,
} from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarLayout';
import { ComposerSession } from 'app/features/dashboard-scene/composer/ComposerSession';
import {
  clearPendingComposerEnterRequest,
  requestComposerEnter,
} from 'app/features/dashboard-scene/composer/composerEntryRequests';
import { DashboardMutationClient } from 'app/features/dashboard-scene/mutation-api/DashboardMutationClient';
import { transformSaveModelToScene } from 'app/features/dashboard-scene/serialization/transformSaveModelToScene';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { setDashboardMutationClientForTests } from '../dashboardMutation/dashboardMutationApi';

import { composerApi } from './composerApi';

// The Assistant's sidebar: the plugin that may float.
const sidebarPresentation = () => getEffectiveExtensionSidebarPresentation('grafana-assistant-app');

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

it('refuses notebook targets, never resolving them to the mounted dashboard', async () => {
  mountDashboard();
  const notebook = { resource: 'notebook', uid: 'composer-api-test' } as const;
  expect(composerApi.canEnter(notebook)).toEqual({ ok: false, reason: 'unsupported' });
  await expect(composerApi.enter(notebook)).rejects.toThrow('unsupported');
});

describe('presentation', () => {
  const FLOATING_FLAG = 'grafana.extensionSidebarFloating';
  const COMPOSER_FLAGS = {
    dashboardNewLayouts: true,
    'grafana.dashboardPreviewMode': true,
    'grafana.dashboardComposer': true,
  };

  // Assistant listening for the picker's requests, as it does while its sidebar is mounted.
  let stopListening = () => {};
  beforeEach(() => {
    stopListening = composerApi.onEnterRequested(() => {});
  });

  afterEach(() => {
    stopListening();
    clearPendingComposerEnterRequest('disposed');
    resetExtensionSidebarPresentationForTests();
  });

  it('floats a docked sidebar for the session, with the floating flag off, and docks it again on exit', async () => {
    mountDashboard();
    const session = await composerApi.enter(DASHBOARD);
    expect(sidebarPresentation()).toBe('floating');

    session.exit();

    expect(sidebarPresentation()).toBe('docked');
  });

  it('leaves a sidebar the user floated floating after the session', async () => {
    setTestFlags({ ...COMPOSER_FLAGS, [FLOATING_FLAG]: true });
    setExtensionSidebarPresentation('floating');
    mountDashboard();
    const session = await composerApi.enter(DASHBOARD);
    expect(sidebarPresentation()).toBe('floating');

    session.exit();

    expect(sidebarPresentation()).toBe('floating');
  });

  it('keeps the floating layout the user picks during the session', async () => {
    setTestFlags({ ...COMPOSER_FLAGS, [FLOATING_FLAG]: true });
    mountDashboard();
    const session = await composerApi.enter(DASHBOARD);
    setExtensionSidebarPresentation('floating');

    session.exit();

    expect(sidebarPresentation()).toBe('floating');
  });

  it('keeps the session open when the user docks the sidebar', async () => {
    mountDashboard();
    const session = await composerApi.enter(DASHBOARD);

    setExtensionSidebarPresentation('docked');

    expect(session.signal.aborted).toBe(false);
    expect(sidebarPresentation()).toBe('docked');
    session.exit();
    expect(sidebarPresentation()).toBe('docked');
  });

  it("keeps the user's mid-session dock after exit, even when they entered floating", async () => {
    setTestFlags({ ...COMPOSER_FLAGS, [FLOATING_FLAG]: true });
    setExtensionSidebarPresentation('floating');
    mountDashboard();
    const session = await composerApi.enter(DASHBOARD);
    setExtensionSidebarPresentation('docked');

    session.exit();

    expect(sidebarPresentation()).toBe('docked');
  });

  it('ends the session when the sidebar closes', async () => {
    mountDashboard();
    const session = await composerApi.enter(DASHBOARD);

    notifyExtensionSidebarClosed();

    expect(session.signal.aborted).toBe(true);
    expect(sidebarPresentation()).toBe('docked');
  });

  it('ends a session the user docked when the sidebar closes', async () => {
    mountDashboard();
    const session = await composerApi.enter(DASHBOARD);
    setExtensionSidebarPresentation('docked');

    notifyExtensionSidebarClosed();

    expect(session.signal.aborted).toBe(true);
  });

  it('stops watching the sidebar once the session ends', async () => {
    mountDashboard();
    const first = await composerApi.enter(DASHBOARD);
    first.exit();
    if (!(first instanceof ComposerSession)) {
      throw new Error('Expected a ComposerSession');
    }
    const endFirst = jest.spyOn(first, 'end');
    const second = await composerApi.enter(DASHBOARD);

    notifyExtensionSidebarClosed();

    expect(second.signal.aborted).toBe(true);
    expect(endFirst).not.toHaveBeenCalled();
  });

  it('enters docked when the user docked the sidebar while the picker request waited', async () => {
    mountDashboard();
    requestComposerEnter(DASHBOARD, { float: true });
    setExtensionSidebarPresentation('docked');

    const session = await composerApi.enter(DASHBOARD);

    expect(session.signal.aborted).toBe(false);
    expect(sidebarPresentation()).toBe('docked');
    session.exit();
  });

  it('docks a sidebar the picker floated when entering fails', async () => {
    requestComposerEnter(DASHBOARD, { float: true });
    expect(sidebarPresentation()).toBe('floating');

    await expect(composerApi.enter(DASHBOARD)).rejects.toThrow('no_document');

    expect(sidebarPresentation()).toBe('docked');
  });

  it("hands the picker's floating sidebar over to the session", async () => {
    mountDashboard();
    requestComposerEnter(DASHBOARD, { float: true });
    const session = await composerApi.enter(DASHBOARD);
    // The request is over; the session holds the sidebar now.
    clearPendingComposerEnterRequest('disposed');
    expect(sidebarPresentation()).toBe('floating');

    session.exit();

    expect(sidebarPresentation()).toBe('docked');
  });

  it("never touches the extension sidebar with presentation 'none', nor ends with it", async () => {
    mountDashboard();
    const session = await composerApi.enter(DASHBOARD, { presentation: 'none' });
    expect(sidebarPresentation()).toBe('docked');

    notifyExtensionSidebarClosed();
    expect(session.signal.aborted).toBe(false);
    session.exit();
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

it('passes notebook requests only to listeners that ask for them', () => {
  const dashboards = jest.fn();
  const both = jest.fn();
  const stopDashboards = composerApi.onEnterRequested(dashboards);
  const stopBoth = composerApi.onEnterRequested(both, { resources: ['dashboard', 'notebook'] });
  const notebook = { resource: 'notebook', uid: 'nb-1' } as const;

  requestComposerEnter(notebook);

  expect(dashboards).not.toHaveBeenCalled();
  expect(both).toHaveBeenCalledWith(notebook);
  stopDashboards();
  stopBoth();
  clearPendingComposerEnterRequest('disposed');
});

describe('telemetry', () => {
  let started: jest.SpyInstance;
  let refused: jest.SpyInstance;
  let ended: jest.SpyInstance;

  beforeEach(() => {
    started = jest.spyOn(DashboardInteractions, 'composerSessionStarted');
    refused = jest.spyOn(DashboardInteractions, 'composerEnterRefused');
    ended = jest.spyOn(DashboardInteractions, 'composerSessionEnded');
  });

  afterEach(() => {
    [started, refused, ended].forEach((spy) => spy.mockRestore());
    resetExtensionSidebarPresentationForTests();
  });

  it('reports a started session under the id it hands the plugin, in the edit period it runs in', async () => {
    const scene = mountDashboard();
    const session = await composerApi.enter(DASHBOARD);

    expect(session.sessionId).toEqual(expect.any(String));
    expect(started).toHaveBeenCalledTimes(1);
    expect(started).toHaveBeenCalledWith({
      dashboard_uid: DASHBOARD.uid,
      edit_session_id: scene.getEditSessionId(),
      composer_session_id: session.sessionId,
      presentation: 'floating',
      sidebar_was_docked: true,
    });
    expect(scene.getEditSessionId()).toEqual(expect.any(String));
    session.exit();
  });

  it('issues a new session id for every session', async () => {
    mountDashboard();
    const first = await composerApi.enter(DASHBOARD);
    first.exit();
    const second = await composerApi.enter(DASHBOARD, { presentation: 'none' });

    expect(second.sessionId).not.toBe(first.sessionId);
    expect(started).toHaveBeenLastCalledWith(expect.objectContaining({ presentation: 'none' }));
    second.exit();
  });

  it('reports the session the sidebar closing ends', async () => {
    mountDashboard();
    const session = await composerApi.enter(DASHBOARD);

    notifyExtensionSidebarClosed();

    expect(ended).toHaveBeenCalledTimes(1);
    expect(ended).toHaveBeenCalledWith(
      expect.objectContaining({ composer_session_id: session.sessionId, reason: 'sidebar_closed' })
    );
  });

  it('reports the plugin leaving as plugin_exit', async () => {
    mountDashboard();
    const session = await composerApi.enter(DASHBOARD);
    session.exit();
    expect(ended).toHaveBeenCalledWith(expect.objectContaining({ reason: 'plugin_exit' }));
  });

  it.each([
    ['no dashboard is mounted', () => {}, DASHBOARD, { reason: 'no_document', detail: 'not_mounted' }],
    [
      'the target is another dashboard',
      mountDashboard,
      { resource: 'dashboard', uid: 'another-dashboard' } as const,
      { reason: 'no_document', detail: 'other_document' },
    ],
    [
      'the target is a notebook',
      mountDashboard,
      { resource: 'notebook', uid: 'composer-api-test' } as const,
      { reason: 'unsupported', detail: 'notebook' },
    ],
  ])('reports a refused entry when %s', async (_, arrange, target, refusal) => {
    arrange();
    await expect(composerApi.enter(target)).rejects.toThrow(refusal.reason);
    expect(refused).toHaveBeenCalledWith({ dashboard_uid: target.uid, ...refusal });
    expect(started).not.toHaveBeenCalled();
  });

  it('reports a second entry while a session is open as already active, and never canEnter probes', async () => {
    mountDashboard();
    const session = await composerApi.enter(DASHBOARD);
    composerApi.canEnter(DASHBOARD);
    expect(refused).not.toHaveBeenCalled();

    await expect(composerApi.enter(DASHBOARD)).rejects.toThrow('unsupported');

    expect(refused).toHaveBeenCalledWith({
      dashboard_uid: DASHBOARD.uid,
      reason: 'unsupported',
      detail: 'already_active',
    });
    session.exit();
  });
});
