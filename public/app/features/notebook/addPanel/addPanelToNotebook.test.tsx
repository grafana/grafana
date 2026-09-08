import { configureStore } from '@reduxjs/toolkit';
import { HttpResponse, http, type PathParams } from 'msw';
import { type UnknownAction } from 'redux';

import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { dashboardAPIv2beta1 } from 'app/api/clients/dashboard/v2beta1';
import { backendSrv } from 'app/core/services/backend_srv';

import { NotebookConflictError } from '../api/notebookResource';
import { defaultPanelKind, type PanelKind, type Spec as NotebookSpec } from '../types';

import { addPanelErrorMessage, addPanelToExistingNotebook, createNotebookWithPanel } from './addPanelToNotebook';

const NOTEBOOKS_URL = '/apis/dashboard.grafana.app/v2beta1/namespaces/:namespace/notebooks';
const NOTEBOOK_URL = `${NOTEBOOKS_URL}/:name`;

// The api clients issue their requests through the backend service, which msw then intercepts.
setBackendSrv(backendSrv);
setupMockServer();

// notebookResource dispatches through the app store; route that to a test store carrying the
// dashboard v2beta1 API so the RTK queries actually run. Same approach as the mutation-api tests.
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

beforeEach(() => {
  testStore = createTestStore();
});

function panel(title: string): PanelKind {
  const base = defaultPanelKind();
  return { ...base, spec: { ...base.spec, id: 1, title } };
}

function existingNotebook() {
  return {
    apiVersion: 'dashboard.grafana.app/v2beta1',
    kind: 'Notebook',
    metadata: { name: 'nb1', resourceVersion: '42' },
    spec: {
      title: 'Checkout error spike',
      tags: ['incident'],
      elements: {},
      layout: { kind: 'NotebookLayout', spec: { cells: [] } },
      timeSettings: { from: 'now-6h', to: 'now' },
    },
  };
}

interface NotebookRequestBody {
  apiVersion?: string;
  kind?: string;
  metadata?: { name?: string; resourceVersion?: string; generateName?: string };
  spec?: NotebookSpec;
}

interface CapturedRequest {
  body?: NotebookRequestBody;
}

/** Serves the notebook and records whatever is written back to it. */
function captureWrite(): CapturedRequest {
  const captured: CapturedRequest = {};

  server.use(
    http.get(NOTEBOOK_URL, () => HttpResponse.json(existingNotebook())),
    http.put<PathParams, NotebookRequestBody>(NOTEBOOK_URL, async ({ request }) => {
      captured.body = await request.json();
      return HttpResponse.json(captured.body);
    })
  );

  return captured;
}

/** `null` serves a response with no name — passing `undefined` would re-trigger the default. */
function captureCreate(name: string | null = 'nb2'): CapturedRequest {
  const captured: CapturedRequest = {};

  server.use(
    http.post<PathParams, NotebookRequestBody>(NOTEBOOKS_URL, async ({ request }) => {
      captured.body = await request.json();
      return HttpResponse.json({ metadata: name ? { name } : {}, spec: captured.body.spec });
    })
  );

  return captured;
}

describe('addPanelToExistingNotebook', () => {
  it('writes back the fetched notebook with the panel appended', async () => {
    const captured = captureWrite();

    const added = await addPanelToExistingNotebook('nb1', panel('p95 latency'));

    expect(added).toEqual({ uid: 'nb1', title: 'Checkout error spike' });
    expect(Object.keys(captured.body!.spec!.elements)).toEqual(['p95-latency']);
    expect(captured.body!.spec!.layout.spec.cells).toHaveLength(1);
    // Everything the notebook already had survives the round trip.
    expect(captured.body!.spec!.tags).toEqual(['incident']);
  });

  // Without this the apiserver has nothing to compare against and a concurrent edit is silently
  // overwritten instead of rejected.
  it('sends the resourceVersion it read back with the write', async () => {
    const captured = captureWrite();

    await addPanelToExistingNotebook('nb1', panel('p95 latency'));

    expect(captured.body!.metadata?.resourceVersion).toBe('42');
  });

  // Typed rather than a status code, so the modal does not have to sniff the transport for it.
  it('raises a conflict when the notebook moved on', async () => {
    server.use(
      http.get(NOTEBOOK_URL, () => HttpResponse.json(existingNotebook())),
      http.put(NOTEBOOK_URL, () => HttpResponse.json({ message: 'the object has been modified' }, { status: 409 }))
    );

    await expect(addPanelToExistingNotebook('nb1', panel('p95 latency'))).rejects.toBeInstanceOf(NotebookConflictError);
  });

  it('surfaces the apiserver message when the write fails for another reason', async () => {
    server.use(
      http.get(NOTEBOOK_URL, () => HttpResponse.json(existingNotebook())),
      http.put(NOTEBOOK_URL, () => HttpResponse.json({ message: 'notebook is too large' }, { status: 400 }))
    );

    await expect(addPanelToExistingNotebook('nb1', panel('p95 latency'))).rejects.toThrow('notebook is too large');
  });
});

describe('createNotebookWithPanel', () => {
  it('creates a notebook carrying the panel, description and tags', async () => {
    const captured = captureCreate();

    const added = await createNotebookWithPanel(
      { title: 'Checkout latency investigation', description: 'What are you investigating?', tags: ['latency'] },
      panel('p95 latency')
    );

    expect(added).toEqual({ uid: 'nb2', title: 'Checkout latency investigation' });
    expect(captured.body!.spec).toMatchObject({
      title: 'Checkout latency investigation',
      description: 'What are you investigating?',
      tags: ['latency'],
    });
    expect(Object.keys(captured.body!.spec!.elements)).toEqual(['p95-latency']);
  });

  // A k8s create body carries its own type; the apiserver does not infer it from the endpoint.
  it('sends a create body the apiserver can type', async () => {
    const captured = captureCreate();

    await createNotebookWithPanel({ title: 'Untitled', description: '', tags: [] }, panel('Chart'));

    expect(captured.body!.apiVersion).toBe('dashboard.grafana.app/v2beta1');
    expect(captured.body!.kind).toBe('Notebook');
    expect(captured.body!.metadata?.generateName).toBe('n');
  });

  it('omits an empty description rather than writing one the user never typed', async () => {
    const captured = captureCreate();

    await createNotebookWithPanel({ title: 'Untitled', description: '', tags: [] }, panel('Chart'));

    expect(captured.body!.spec).not.toHaveProperty('description');
  });

  // The notebook exists but cannot be opened, so this is a failure rather than a link-less success:
  // there is nothing to hand the user and nothing to retry against.
  it('fails when the create response carries no name', async () => {
    captureCreate(null);

    await expect(createNotebookWithPanel({ title: 'Untitled', tags: [] }, panel('Chart'))).rejects.toThrow(
      /carried no name/
    );
  });
});

describe('addPanelErrorMessage', () => {
  it('names the conflict so the user knows retrying will work', () => {
    expect(addPanelErrorMessage(new NotebookConflictError('modified'))).toContain('changed while you were adding');
  });

  it("passes through the resource module's message for anything else", () => {
    expect(addPanelErrorMessage(new Error('notebook is too large'))).toBe('notebook is too large');
  });

  it.each([undefined, 'not an error', new Error('')])('falls back to the generic message for %p', (error) => {
    expect(addPanelErrorMessage(error)).toBe('Failed to add the panel to the notebook');
  });
});
