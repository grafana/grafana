import { configureStore } from '@reduxjs/toolkit';
import { type UnknownAction } from 'redux';
import { of, throwError } from 'rxjs';
import { createFetchResponse } from 'test/helpers/createFetchResponse';

import { type BackendSrv, setBackendSrv } from '@grafana/runtime';
import { dashboardAPIv2beta1 } from 'app/api/clients/dashboard/v2beta1';

import { codeCell, markdownCell, notebookSpec } from '../mutation-api/test-utils';
import { type Spec as NotebookSpec } from '../types';

import { updateNotebook } from './notebookResource';

// The write dispatches through the app store; route that dispatch to a test store carrying the dashboard
// v2beta1 API so the real RTK mutation, and the real base query that decides the patch content type, both
// run. Only the transport is faked.
const createTestStore = () =>
  configureStore({
    reducer: { [dashboardAPIv2beta1.reducerPath]: dashboardAPIv2beta1.reducer },
    // The dev-only serializable/immutable checks log on the error path (the rejected RTK action carries an
    // Error instance) and jest-fail-on-console turns that into a failure.
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

/** What the apiserver returns from a notebook write: the whole resource, not just the fields one test reads. */
function savedNotebook(spec: NotebookSpec, generation = 2) {
  return {
    apiVersion: 'dashboard.grafana.app/v2beta1',
    kind: 'Notebook',
    metadata: {
      name: 'nb-1',
      namespace: 'default',
      uid: '9f1c4d2e-0b7a-4c33-8a11-6d2e5b8f0c41',
      resourceVersion: '1755',
      generation,
      creationTimestamp: '2026-08-17T09:12:44Z',
      annotations: { 'grafana.app/folder': 'incidents' },
    },
    spec,
  };
}

function fetchOf(response: unknown) {
  const fetch = jest.fn().mockReturnValue(of(createFetchResponse(response)));
  setBackendSrv({ fetch } as unknown as BackendSrv);
  return fetch;
}

describe('updateNotebook', () => {
  beforeEach(() => {
    testStore = createTestStore();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('patches the notebook by replacing its whole spec in one json-patch op', async () => {
    const spec = notebookSpec();
    const fetch = fetchOf(savedNotebook(spec));

    await updateNotebook('nb-1', spec);

    expect(fetch).toHaveBeenCalledTimes(1);
    const request = fetch.mock.calls[0][0];
    expect(request.method).toBe('PATCH');
    expect(request.url).toMatch(/\/notebooks\/nb-1$/);
    expect(request.data).toEqual([{ op: 'replace', path: '/spec', value: spec }]);
    // Not merge-patch: the base query infers this from the op array, and the whole point of the op array
    // is that a merge patch would keep elements this spec no longer has.
    expect(request.headers['Content-Type']).toBe('application/json-patch+json');
  });

  it("returns the resource's new generation, so a caller can update what it cached", async () => {
    const spec = notebookSpec();
    fetchOf(savedNotebook(spec, 7));

    await expect(updateNotebook('nb-1', spec)).resolves.toEqual({ generation: 7 });
  });

  it('sends only the remaining elements once a cell is deleted', async () => {
    // The case a merge patch gets wrong: `query` is gone from both the layout and the elements map, and a
    // patch that merely mentioned the survivors would leave it on the server.
    const spec = notebookSpec({
      elements: { intro: markdownCell('## Checkout latency spike') },
      cells: ['intro'],
    });
    const fetch = fetchOf(savedNotebook(spec));

    await updateNotebook('nb-1', spec);

    const sentSpec = fetch.mock.calls[0][0].data[0].value;
    expect(Object.keys(sentSpec.elements)).toEqual(['intro']);
    expect(sentSpec.layout.spec.cells).toHaveLength(1);
  });

  it("throws the apiserver's own rejection message", async () => {
    setBackendSrv({
      fetch: jest
        .fn()
        .mockReturnValue(throwError(() => ({ status: 400, data: { message: 'spec.layout: unsupported kind' } }))),
    } as unknown as BackendSrv);

    await expect(updateNotebook('nb-1', notebookSpec())).rejects.toThrow('spec.layout: unsupported kind');
  });

  it('throws rather than reporting a saved notebook when the write fails with no message', async () => {
    setBackendSrv({
      fetch: jest.fn().mockReturnValue(throwError(() => ({ status: 500 }))),
    } as unknown as BackendSrv);

    // The message here comes from the shared base query's normalization, so this only pins that a failure
    // reaches the caller at all: resolving would report a generation of undefined as if the save worked.
    await expect(
      updateNotebook('nb-1', notebookSpec({ elements: { query: codeCell('up') }, cells: ['query'] }))
    ).rejects.toThrow();
  });
});
