import { configureStore } from '@reduxjs/toolkit';
import { type UnknownAction } from 'redux';
import { of, throwError } from 'rxjs';
import { createFetchResponse } from 'test/helpers/createFetchResponse';

import { type BackendSrv, setBackendSrv } from '@grafana/runtime';
import { type Spec as NotebookSpec, defaultSpec as defaultNotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';
import { dashboardAPIv2beta1 } from 'app/api/clients/dashboard/v2beta1';
import { type Resource } from 'app/features/apiserver/types';

import { NotebookScene } from '../scene/NotebookScene';

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

function notebookResource(): Resource<NotebookSpec> {
  return {
    apiVersion: 'dashboard.grafana.app/v2beta1',
    kind: 'Notebook',
    metadata: { name: 'nb-1', resourceVersion: '1', generation: 1, creationTimestamp: '2026-07-01T00:00:00Z' },
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
    const first = manager.state.scene;
    await manager.loadNotebook('nb-1');

    expect(manager.state.scene).toBe(first);
  });

  it('surfaces a fetch failure as loadError instead of a scene', async () => {
    setBackendSrv({
      fetch: jest.fn().mockReturnValue(throwError(() => new Error('nope'))),
    } as unknown as BackendSrv);
    const manager = new NotebookPageStateManager({ isLoading: false });

    await manager.loadNotebook('missing');

    expect(manager.state.scene).toBeUndefined();
    expect(manager.state.isLoading).toBe(false);
    expect(manager.state.loadError).toBeInstanceOf(Error);
  });
});
