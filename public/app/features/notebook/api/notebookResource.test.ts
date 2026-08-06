import { configureStore } from '@reduxjs/toolkit';
import { type UnknownAction } from 'redux';
import { of } from 'rxjs';
import { createFetchResponse } from 'test/helpers/createFetchResponse';

import { type BackendSrv, getBackendSrv, setBackendSrv } from '@grafana/runtime';
import { type Spec as NotebookSpec, defaultSpec as defaultNotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';
import { dashboardAPIv2beta1 } from 'app/api/clients/dashboard/v2beta1';
import { dispatch } from 'app/store/store';

import { createNotebook } from './notebookResource';

// Same seam as the page loader's suite: route the module's dispatch to a store that carries the
// dashboard v2beta1 API, so the RTK mutation really runs and the request it builds is observable.
const createTestStore = () =>
  configureStore({
    reducer: { [dashboardAPIv2beta1.reducerPath]: dashboardAPIv2beta1.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(dashboardAPIv2beta1.middleware),
  });

let testStore: ReturnType<typeof createTestStore>;

jest.mock('app/store/store', () => {
  const actual = jest.requireActual('app/store/store');
  return {
    ...actual,
    dispatch: jest.fn((action: UnknownAction) => (testStore ? testStore.dispatch(action) : action)),
  };
});

function notebookSpec(): NotebookSpec {
  return {
    ...defaultNotebookSpec(),
    title: 'Checkout latency investigation',
    elements: { intro: { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: 'p99 spike' } } } } },
    layout: {
      kind: 'NotebookLayout',
      spec: {
        cells: [
          {
            kind: 'NotebookLayoutItem',
            spec: { element: { kind: 'ElementReference', name: 'intro' }, source: 'user' },
          },
        ],
      },
    },
  };
}

/** The single request the mutation made. */
function requestBody() {
  const fetch = jest.mocked(getBackendSrv().fetch);
  return fetch.mock.calls[0][0];
}

beforeEach(() => {
  testStore = createTestStore();
});

describe('createNotebook', () => {
  it('returns the uid the apiserver assigned, and where to open it', async () => {
    setBackendSrv({
      fetch: jest.fn().mockReturnValue(of(createFetchResponse({ metadata: { name: 'n-abc123' } }))),
    } as unknown as BackendSrv);

    expect(await createNotebook(notebookSpec())).toEqual({ uid: 'n-abc123', url: '/notebook/n-abc123' });
  });

  // The apiserver names the resource, not the caller: a client-chosen uid can collide with one that
  // already exists, and there is no reason for a caller to invent one.
  it('asks the server to name it rather than naming it itself', async () => {
    setBackendSrv({
      fetch: jest.fn().mockReturnValue(of(createFetchResponse({ metadata: { name: 'n-abc123' } }))),
    } as unknown as BackendSrv);

    await createNotebook(notebookSpec());

    const body = requestBody();
    expect(body.method).toBe('POST');
    expect(body.data).toMatchObject({
      apiVersion: 'dashboard.grafana.app/v2beta1',
      kind: 'Notebook',
      metadata: { generateName: 'n' },
    });
    expect(body.data.metadata.name).toBeUndefined();
  });

  it('surfaces the apiserver message when the write is rejected', async () => {
    jest
      .mocked(dispatch)
      .mockReturnValueOnce(
        Promise.resolve({ error: { status: 400, data: { message: 'spec.layout: unsupported kind' } } })
      );

    await expect(createNotebook(notebookSpec())).rejects.toThrow('spec.layout: unsupported kind');
  });

  // A 200 with no name is not a success a caller can act on: there is nothing to navigate to, and
  // reporting success would leave the user on the page they started from with no notebook in sight.
  it('fails when the response carries no name', async () => {
    setBackendSrv({
      fetch: jest.fn().mockReturnValue(of(createFetchResponse({ metadata: {} }))),
    } as unknown as BackendSrv);

    await expect(createNotebook(notebookSpec())).rejects.toThrow('carried no name');
  });
});
