import { configureStore } from '@reduxjs/toolkit';
import { type UnknownAction } from 'redux';
import { delay, of, throwError } from 'rxjs';
import { createFetchResponse } from 'test/helpers/createFetchResponse';

import { type BackendSrv, setBackendSrv } from '@grafana/runtime';
import { dashboardAPIv2beta1 } from 'app/api/clients/dashboard/v2beta1';
import { type Resource } from 'app/features/apiserver/types';

import { NotebookScene } from '../scene/NotebookScene';
import { type Spec as NotebookSpec, defaultSpec as defaultNotebookSpec } from '../types';

import { NotebookPageStateManager } from './NotebookPageStateManager';

// The state manager dispatches the notebook query through the app store; route that dispatch to a
// test store that carries the dashboard v2beta1 API so the RTK query actually runs.
const createTestStore = () =>
  configureStore({
    reducer: { [dashboardAPIv2beta1.reducerPath]: dashboardAPIv2beta1.reducer },
    // The dev-only serializable/immutable checks log on the error path (the rejected RTK action
    // carries an Error instance) and jest-fail-on-console turns that into a failure.
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ serializableCheck: false, immutableCheck: false }).concat(dashboardAPIv2beta1.middleware),
  });

let testStore: ReturnType<typeof createTestStore>;

jest.mock('app/store/store', () => {
  const actual = jest.requireActual('app/store/store');
  return {
    ...actual,
    dispatch: jest.fn((action: UnknownAction) => (testStore ? testStore.dispatch(action) : action)),
  };
});

function notebookResource(name = 'nb-1'): Resource<NotebookSpec> {
  return {
    apiVersion: 'dashboard.grafana.app/v2beta1',
    kind: 'Notebook',
    metadata: { name, resourceVersion: '1', generation: 1, creationTimestamp: '2026-07-01T00:00:00Z' },
    spec: {
      ...defaultNotebookSpec(),
      title: 'My notebook',
      tags: ['incident'],
      elements: {
        md1: { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: 'Hello' } } } },
      },
      layout: {
        kind: 'NotebookLayout',
        spec: {
          cells: [
            {
              kind: 'NotebookLayoutItem',
              spec: { element: { kind: 'ElementReference', name: 'md1' }, source: 'assistant' },
            },
          ],
        },
      },
    },
  };
}

describe('NotebookPageStateManager', () => {
  beforeEach(() => {
    testStore = createTestStore();
  });

  it('fetches the notebook and builds a NotebookScene', async () => {
    setBackendSrv({
      fetch: jest.fn().mockReturnValue(of(createFetchResponse(notebookResource()))),
    } as unknown as BackendSrv);
    const manager = new NotebookPageStateManager({ isLoading: false });

    await manager.loadNotebook('nb-1');

    expect(manager.state.loadError).toBeUndefined();
    expect(manager.state.isLoading).toBe(false);
    expect(manager.state.scene).toBeInstanceOf(NotebookScene);
    expect(manager.state.scene?.state.title).toBe('My notebook');
    expect(manager.state.scene?.state.body.state.cells).toHaveLength(1);
  });

  it('reuses the cached scene when the resource generation is unchanged', async () => {
    setBackendSrv({
      fetch: jest.fn().mockReturnValue(of(createFetchResponse(notebookResource()))),
    } as unknown as BackendSrv);
    const manager = new NotebookPageStateManager({ isLoading: false });

    await manager.loadNotebook('nb-1');
    const first = manager.state.scene?.state.key;
    await manager.loadNotebook('nb-1');

    expect(manager.state.scene?.state.key).toBe(first);
  });

  it('rebuilds the scene after removeSceneCache, even at an unchanged generation', async () => {
    setBackendSrv({
      fetch: jest.fn().mockReturnValue(of(createFetchResponse(notebookResource()))),
    } as unknown as BackendSrv);
    const manager = new NotebookPageStateManager({ isLoading: false });

    await manager.loadNotebook('nb-1');
    const first = manager.state.scene?.state.key;
    manager.removeSceneCache('nb-1');
    await manager.loadNotebook('nb-1');

    expect(manager.state.scene).toBeInstanceOf(NotebookScene);
    expect(manager.state.scene?.state.key).not.toBe(first);
  });

  it('rebuilds every notebook after clearSceneCache', async () => {
    setBackendSrv({
      fetch: jest.fn((options: { url: string }) =>
        of(createFetchResponse(notebookResource(options.url.endsWith('nb-2') ? 'nb-2' : 'nb-1')))
      ),
    } as unknown as BackendSrv);
    const manager = new NotebookPageStateManager({ isLoading: false });

    await manager.loadNotebook('nb-1');
    const firstOne = manager.state.scene?.state.key;
    await manager.loadNotebook('nb-2');
    const firstTwo = manager.state.scene?.state.key;
    // Guards the mock: if both loads resolved to the same cache entry the test below would pass
    // trivially without ever proving two entries were cleared.
    expect(firstTwo).not.toBe(firstOne);

    manager.clearSceneCache();

    await manager.loadNotebook('nb-1');
    expect(manager.state.scene?.state.key).not.toBe(firstOne);
    await manager.loadNotebook('nb-2');
    expect(manager.state.scene?.state.key).not.toBe(firstTwo);
  });

  it('ignores removeSceneCache for an unknown uid and leaves other entries cached', async () => {
    setBackendSrv({
      fetch: jest.fn().mockReturnValue(of(createFetchResponse(notebookResource()))),
    } as unknown as BackendSrv);
    const manager = new NotebookPageStateManager({ isLoading: false });

    await manager.loadNotebook('nb-1');
    const first = manager.state.scene?.state.key;

    expect(() => manager.removeSceneCache('does-not-exist')).not.toThrow();

    await manager.loadNotebook('nb-1');
    expect(manager.state.scene?.state.key).toBe(first);
  });

  // `await` does not cancel, so a load started for an earlier uid still resumes. If it wrote its
  // scene the page would end up on B's URL showing A, and stay there — nothing fires afterwards.
  // The slow/fast split reproduces the ordering inversion an RTK cache hit causes in practice.
  it('ignores a superseded load so fast navigation cannot show the previous notebook', async () => {
    setBackendSrv({
      fetch: jest.fn((options: { url: string }) => {
        const isSlow = options.url.endsWith('nb-slow');
        return of(createFetchResponse(notebookResource(isSlow ? 'nb-slow' : 'nb-fast'))).pipe(delay(isSlow ? 50 : 0));
      }),
    } as unknown as BackendSrv);
    const manager = new NotebookPageStateManager({ isLoading: false });

    const slow = manager.loadNotebook('nb-slow');
    const fast = manager.loadNotebook('nb-fast');
    await Promise.all([fast, slow]);

    expect(manager.state.scene?.state.uid).toBe('nb-fast');
    expect(manager.state.loadError).toBeUndefined();
  });

  it('ignores a superseded failure so a stale error cannot replace a loaded notebook', async () => {
    setBackendSrv({
      fetch: jest.fn((options: { url: string }) =>
        options.url.endsWith('nb-slow')
          ? throwError(() => ({ status: 404, data: { message: 'gone' } })).pipe(delay(50))
          : of(createFetchResponse(notebookResource('nb-fast')))
      ),
    } as unknown as BackendSrv);
    const manager = new NotebookPageStateManager({ isLoading: false });

    const slow = manager.loadNotebook('nb-slow');
    const fast = manager.loadNotebook('nb-fast');
    await Promise.all([fast, slow]);

    expect(manager.state.loadError).toBeUndefined();
    expect(manager.state.scene?.state.uid).toBe('nb-fast');
  });

  it('surfaces a fetch failure as loadError instead of a scene', async () => {
    setBackendSrv({
      fetch: jest.fn().mockReturnValue(throwError(() => new Error('nope'))),
    } as unknown as BackendSrv);
    const manager = new NotebookPageStateManager({ isLoading: false });

    await manager.loadNotebook('missing');

    expect(manager.state.scene).toBeUndefined();
    expect(manager.state.isLoading).toBe(false);
    expect(manager.state.loadError?.message).toBe('nope');
  });

  // RTK rejects with { status, data } rather than an Error. Both fields have to survive: the status
  // drives the 404 not-found state and the body carries the backend message.
  it('preserves the HTTP status and backend message of an API failure', async () => {
    setBackendSrv({
      fetch: jest.fn().mockReturnValue(throwError(() => ({ status: 404, data: { message: 'notebook not found' } }))),
    } as unknown as BackendSrv);
    const manager = new NotebookPageStateManager({ isLoading: false });

    await manager.loadNotebook('missing');

    expect(manager.state.scene).toBeUndefined();
    expect(manager.state.loadError).toEqual({
      status: 404,
      message: 'notebook not found',
      messageId: undefined,
    });
  });
});
