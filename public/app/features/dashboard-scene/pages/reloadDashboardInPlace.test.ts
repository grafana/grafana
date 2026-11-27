import { DashboardRoutes } from 'app/types/dashboard';

import { type DashboardScene } from '../scene/DashboardScene';

import { reloadDashboardInPlace, type UnifiedDashboardScenePageStateManager } from './DashboardScenePageStateManager';

jest.mock('../actions/dashboard/applyDashboardSpec', () => ({
  ...jest.requireActual('../actions/dashboard/applyDashboardSpec'),
  swapInReloadedDashboard: jest.fn(),
}));
jest.mock('app/features/dashboard/api/utils', () => ({
  ...jest.requireActual('app/features/dashboard/api/utils'),
  isDashboardV2Resource: () => true,
}));

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

function setup() {
  const open = {
    rebaselineEditSession: jest.fn(),
    setInitialSaveModel: jest.fn(),
    state: { uid: 'abc', meta: {} },
  } as unknown as DashboardScene;
  const responses: Array<ReturnType<typeof deferred<{ spec: { title: string } }>>> = [];
  const manager = {
    state: { dashboard: open },
    clearDashboardCache: jest.fn(),
    removeSceneCache: jest.fn(),
    fetchDashboard: jest.fn(() => {
      const response = deferred<{ spec: { title: string } }>();
      responses.push(response);
      return response.promise;
    }),
    enrichLoadOptions: jest.fn(async (_rsp: unknown, options: unknown) => ({
      ...(options as object),
      defaultVariables: [{ name: 'injected' }],
    })),
    transformResponseToScene: jest.fn((rsp: { spec: { title: string } }) => ({ title: rsp.spec.title })),
    setState: jest.fn(),
  } as unknown as UnifiedDashboardScenePageStateManager & {
    fetchDashboard: jest.Mock;
    transformResponseToScene: jest.Mock;
  };
  return { open, manager, responses };
}

const options = { uid: 'abc', route: DashboardRoutes.Embedded, pendingChanges: 'chat-1' };

describe('reloadDashboardInPlace', () => {
  beforeEach(() => jest.clearAllMocks());

  it('builds the reloaded dashboard with the predefined variables a load adds', async () => {
    const { open, manager, responses } = setup();
    const reloaded = reloadDashboardInPlace(manager, open, options);
    await Promise.resolve();
    responses[0].resolve({ spec: { title: 'Newest' } });

    await expect(reloaded).resolves.toBe(true);
    expect(manager.transformResponseToScene).toHaveBeenCalledWith(
      { spec: { title: 'Newest' } },
      expect.objectContaining({ defaultVariables: [{ name: 'injected' }] })
    );
    expect(open.setInitialSaveModel).toHaveBeenCalled();
  });

  // An older response finishing last would replace the newer dashboard.
  it('runs one reload of a scene at a time, and skips one a newer reload overtook', async () => {
    const { open, manager, responses } = setup();
    const older = reloadDashboardInPlace(manager, open, options);
    await Promise.resolve();
    const overtaken = reloadDashboardInPlace(manager, open, options);
    const newest = reloadDashboardInPlace(manager, open, options);

    expect(manager.fetchDashboard).toHaveBeenCalledTimes(1);
    responses[0].resolve({ spec: { title: 'Older' } });
    await expect(older).resolves.toBe(true);
    // Skipped without a request of its own, and without a fresh load: the newest shows the dashboard.
    await expect(overtaken).resolves.toBe(true);
    await waitForCalls(manager.fetchDashboard, 2);
    responses[1].resolve({ spec: { title: 'Newest' } });
    await expect(newest).resolves.toBe(true);

    // Two requests, swapped in in order: the newest is what the scene shows.
    expect(manager.fetchDashboard).toHaveBeenCalledTimes(2);
    expect(manager.transformResponseToScene.mock.calls.map(([rsp]) => rsp.spec.title)).toEqual(['Older', 'Newest']);
    expect(open.setInitialSaveModel).toHaveBeenLastCalledWith({ title: 'Newest' }, undefined, undefined);
  });
});

async function waitForCalls(mock: jest.Mock, count: number) {
  for (let i = 0; i < 10 && mock.mock.calls.length < count; i++) {
    await Promise.resolve();
  }
  expect(mock).toHaveBeenCalledTimes(count);
}
