import { act, renderHook } from '@testing-library/react';

import { type DashboardScene } from '../scene/DashboardScene';

import { useDashboardPageContext } from './useDashboardPageContext';

// Capture the latest setter handed back by `useProvidePageContext` so
// each test can inspect what the hook published into page context.
const setContext = jest.fn();

jest.mock('@grafana/assistant', () => ({
  __esModule: true,
  useProvidePageContext: jest.fn(() => setContext),
  // Mirror just enough of the real `createAssistantContextItem('dashboard', …)`
  // shape that the assertions below can pin the wire contract without
  // pulling in the SDK's class hierarchy.
  createAssistantContextItem: jest.fn((type: string, params: unknown) => ({ type, params })),
}));

interface SceneStub {
  state: DashboardScene['state'];
  subscribeToState: jest.Mock;
  // Test helper — not part of the real DashboardScene surface.
  __emit: (next: Partial<DashboardScene['state']>) => void;
}

function makeSceneStub(initial: Partial<DashboardScene['state']> = {}): SceneStub {
  const listeners = new Set<(state: DashboardScene['state']) => void>();
  const stub: SceneStub = {
    state: {
      title: 'Checkout Overview',
      uid: 'checkout-overview',
      meta: {},
      links: [],
      body: {} as DashboardScene['state']['body'],
      ...initial,
    } as DashboardScene['state'],
    subscribeToState: jest.fn((cb: (state: DashboardScene['state']) => void) => {
      listeners.add(cb);
      return { unsubscribe: () => listeners.delete(cb) };
    }),
    __emit: (next) => {
      stub.state = { ...stub.state, ...next } as DashboardScene['state'];
      for (const cb of listeners) {
        cb(stub.state);
      }
    },
  };
  return stub;
}

describe('useDashboardPageContext', () => {
  beforeEach(() => {
    setContext.mockClear();
  });

  it('publishes a dashboard context item when uid and title are available', () => {
    const dashboard = makeSceneStub({
      uid: 'checkout-overview',
      title: 'Checkout Overview',
      meta: { folderUid: 'fld-checkout', folderTitle: 'Checkout' },
    });

    renderHook(() => useDashboardPageContext(dashboard as unknown as DashboardScene));

    expect(setContext).toHaveBeenLastCalledWith([
      {
        type: 'dashboard',
        params: {
          dashboardUid: 'checkout-overview',
          dashboardTitle: 'Checkout Overview',
          folderUid: 'fld-checkout',
          folderTitle: 'Checkout',
        },
      },
    ]);
  });

  it('clears the context when no dashboard is provided', () => {
    renderHook(() => useDashboardPageContext(undefined));

    // The hook always clears on the "no record" path so a stale
    // registration from a previous page doesn't leak into the chat.
    expect(setContext).toHaveBeenLastCalledWith([]);
  });

  it('skips registration for snapshots and embedded dashboards', () => {
    const snapshot = makeSceneStub({
      uid: 'snap-1',
      title: 'Snapshot',
      meta: { isSnapshot: true },
    });

    renderHook(() => useDashboardPageContext(snapshot as unknown as DashboardScene));
    expect(setContext).toHaveBeenLastCalledWith([]);

    setContext.mockClear();

    const embedded = makeSceneStub({
      uid: 'emb-1',
      title: 'Embedded',
      meta: { isEmbedded: true },
    });

    renderHook(() => useDashboardPageContext(embedded as unknown as DashboardScene));
    expect(setContext).toHaveBeenLastCalledWith([]);
  });

  it('skips registration when uid is missing (new/unsaved dashboard)', () => {
    const newDashboard = makeSceneStub({
      uid: undefined,
      title: 'New dashboard',
      meta: {},
    });

    renderHook(() => useDashboardPageContext(newDashboard as unknown as DashboardScene));

    expect(setContext).toHaveBeenLastCalledWith([]);
  });

  it('re-publishes when the dashboard title changes (rename/save)', () => {
    const dashboard = makeSceneStub({
      uid: 'checkout-overview',
      title: 'Checkout Overview',
      meta: {},
    });

    renderHook(() => useDashboardPageContext(dashboard as unknown as DashboardScene));

    expect(setContext).toHaveBeenLastCalledWith([
      expect.objectContaining({
        type: 'dashboard',
        params: expect.objectContaining({ dashboardTitle: 'Checkout Overview' }),
      }),
    ]);

    act(() => {
      dashboard.__emit({ title: 'Checkout — production' });
    });

    expect(setContext).toHaveBeenLastCalledWith([
      expect.objectContaining({
        type: 'dashboard',
        params: expect.objectContaining({ dashboardTitle: 'Checkout — production' }),
      }),
    ]);
  });

  it('unsubscribes from the scene on unmount', () => {
    const dashboard = makeSceneStub();

    const { unmount } = renderHook(() => useDashboardPageContext(dashboard as unknown as DashboardScene));

    expect(dashboard.subscribeToState).toHaveBeenCalledTimes(1);
    const subscription = dashboard.subscribeToState.mock.results[0].value;
    const unsubscribeSpy = jest.spyOn(subscription, 'unsubscribe');

    unmount();

    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
  });
});
