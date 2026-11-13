import { configureStore } from '@reduxjs/toolkit';
import { HttpResponse, http, type PathParams } from 'msw';
import { type UnknownAction } from 'redux';

import { locationService, setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { dashboardAPIv2beta1 } from 'app/api/clients/dashboard/v2beta1';
import { backendSrv } from 'app/core/services/backend_srv';

import { NotebookAnalytics } from '../analytics/main';
import { NOTEBOOK_ENTRY_POINT } from '../analytics/types';
import { NotebookConflictError } from '../api/notebookResource';
import { defaultPanelKind, type PanelKind, type Spec as NotebookSpec } from '../types';

import {
  addPanelErrorMessage,
  addPanelFailureReason,
  addToExistingNotebook,
  createNotebookWithContent,
} from './addPanelToNotebook';

jest.mock('../analytics/main', () => ({
  NotebookAnalytics: { created: jest.fn(), cellAddedFromAddToNotebook: jest.fn() },
}));

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
  jest.mocked(NotebookAnalytics.created).mockClear();
  jest.mocked(NotebookAnalytics.cellAddedFromAddToNotebook).mockClear();
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

describe('addToExistingNotebook', () => {
  it('retains the source app while the notebook write is in flight', async () => {
    captureWrite();
    locationService.push('/a/grafana-agento11y-app/analytics');
    const saving = addToExistingNotebook('nb1', [{ kind: 'markdown', text: 'Finding' }], 'plugin');
    locationService.push('/a/grafana-k6-app/tests/123');
    await saving;
    expect(NotebookAnalytics.cellAddedFromAddToNotebook).toHaveBeenCalledWith(
      'nb1',
      'plugin',
      0,
      undefined,
      false,
      'agent_o11y'
    );
    locationService.push('/');
  });
  it('writes back the fetched notebook with the panel appended', async () => {
    const captured = captureWrite();

    const added = await addToExistingNotebook(
      'nb1',
      [{ kind: 'panel', panel: panel('p95 latency'), isLibraryPanel: false }],
      NOTEBOOK_ENTRY_POINT.EXPLORE
    );

    expect(added).toEqual({ uid: 'nb1', title: 'Checkout error spike' });
    expect(Object.keys(captured.body!.spec!.elements)).toEqual(['p95-latency']);
    expect(captured.body!.spec!.layout.spec.cells).toHaveLength(1);
    // Everything the notebook already had survives the round trip.
    expect(captured.body!.spec!.tags).toEqual(['incident']);
  });

  it('attributes the panel to the source given', async () => {
    const captured = captureWrite();

    await addToExistingNotebook(
      'nb1',
      [{ kind: 'panel', panel: panel('p95 latency'), isLibraryPanel: false }],
      NOTEBOOK_ENTRY_POINT.PLUGIN,
      'assistant'
    );

    expect(captured.body!.spec!.layout.spec.cells.map((cell) => cell.spec.source)).toEqual(['assistant']);
  });

  // Without this the apiserver has nothing to compare against and a concurrent edit is silently
  // overwritten instead of rejected.
  it('sends the resourceVersion it read back with the write', async () => {
    const captured = captureWrite();

    await addToExistingNotebook(
      'nb1',
      [{ kind: 'panel', panel: panel('p95 latency'), isLibraryPanel: false }],
      NOTEBOOK_ENTRY_POINT.EXPLORE
    );

    expect(captured.body!.metadata?.resourceVersion).toBe('42');
  });

  // Typed rather than a status code, so the modal does not have to sniff the transport for it.
  it('raises a conflict when the notebook moved on', async () => {
    server.use(
      http.get(NOTEBOOK_URL, () => HttpResponse.json(existingNotebook())),
      http.put(NOTEBOOK_URL, () => HttpResponse.json({ message: 'the object has been modified' }, { status: 409 }))
    );

    await expect(
      addToExistingNotebook(
        'nb1',
        [{ kind: 'panel', panel: panel('p95 latency'), isLibraryPanel: false }],
        NOTEBOOK_ENTRY_POINT.EXPLORE
      )
    ).rejects.toBeInstanceOf(NotebookConflictError);
  });

  it('surfaces the apiserver message when the write fails for another reason', async () => {
    server.use(
      http.get(NOTEBOOK_URL, () => HttpResponse.json(existingNotebook())),
      http.put(NOTEBOOK_URL, () => HttpResponse.json({ message: 'notebook is too large' }, { status: 400 }))
    );

    await expect(
      addToExistingNotebook(
        'nb1',
        [{ kind: 'panel', panel: panel('p95 latency'), isLibraryPanel: false }],
        NOTEBOOK_ENTRY_POINT.EXPLORE
      )
    ).rejects.toThrow('notebook is too large');
  });

  // The notebook is not open, so no layout manager sees this cell. appendElementsToNotebook puts the
  // panel at the end, so the position is the last index. The panel goes along so the event can say
  // what was added.
  it('reports the added cell with the caller entry point, the index it landed on and the panel', async () => {
    captureWrite();

    await addToExistingNotebook(
      'nb1',
      [{ kind: 'panel', panel: panel('p95 latency'), isLibraryPanel: false }],
      NOTEBOOK_ENTRY_POINT.DASHBOARD_PANEL
    );

    expect(NotebookAnalytics.cellAddedFromAddToNotebook).toHaveBeenCalledTimes(1);
    expect(NotebookAnalytics.cellAddedFromAddToNotebook).toHaveBeenCalledWith(
      'nb1',
      NOTEBOOK_ENTRY_POINT.DASHBOARD_PANEL,
      0,
      { panel: panel('p95 latency'), isLibraryPanel: false },
      false
    );
  });

  // Only the caller knows. A library panel from a dashboard is inlined before it gets here, so the
  // element reads as an ordinary panel.
  it('passes on that the panel came from the library', async () => {
    captureWrite();

    await addToExistingNotebook(
      'nb1',
      [{ kind: 'panel', panel: panel('p95 latency'), isLibraryPanel: true }],
      NOTEBOOK_ENTRY_POINT.DASHBOARD_PANEL
    );

    expect(NotebookAnalytics.cellAddedFromAddToNotebook).toHaveBeenCalledWith(
      'nb1',
      NOTEBOOK_ENTRY_POINT.DASHBOARD_PANEL,
      0,
      { panel: panel('p95 latency'), isLibraryPanel: true },
      false
    );
  });

  // A chat answer sends its text next to its panels. The markdown has no panel to describe, so it goes
  // without one, and its position follows the cells before it.
  it('reports a markdown cell with no panel, at the index it landed on', async () => {
    captureWrite();

    await addToExistingNotebook(
      'nb1',
      [
        { kind: 'markdown', text: 'p95 is up' },
        { kind: 'panel', panel: panel('p95 latency'), isLibraryPanel: false },
      ],
      NOTEBOOK_ENTRY_POINT.PLUGIN
    );

    expect(NotebookAnalytics.cellAddedFromAddToNotebook).toHaveBeenCalledTimes(2);
    expect(NotebookAnalytics.cellAddedFromAddToNotebook).toHaveBeenNthCalledWith(
      1,
      'nb1',
      NOTEBOOK_ENTRY_POINT.PLUGIN,
      0,
      undefined,
      false,
      'other_plugin'
    );
    expect(NotebookAnalytics.cellAddedFromAddToNotebook).toHaveBeenNthCalledWith(
      2,
      'nb1',
      NOTEBOOK_ENTRY_POINT.PLUGIN,
      1,
      { panel: panel('p95 latency'), isLibraryPanel: false },
      false,
      'other_plugin'
    );
  });

  // The modal's choice, handed over for the event: the cells already carry whatever it did to them.
  it('passes on whether the modal locked the time range', async () => {
    captureWrite();

    await addToExistingNotebook(
      'nb1',
      [{ kind: 'panel', panel: panel('p95 latency'), isLibraryPanel: false }],
      NOTEBOOK_ENTRY_POINT.DASHBOARD_PANEL,
      'user',
      true
    );

    expect(NotebookAnalytics.cellAddedFromAddToNotebook).toHaveBeenCalledWith(
      'nb1',
      NOTEBOOK_ENTRY_POINT.DASHBOARD_PANEL,
      0,
      { panel: panel('p95 latency'), isLibraryPanel: false },
      true
    );
  });

  it('does not report an added cell when the write fails', async () => {
    server.use(
      http.get(NOTEBOOK_URL, () => HttpResponse.json(existingNotebook())),
      http.put(NOTEBOOK_URL, () => HttpResponse.json({ message: 'notebook is too large' }, { status: 400 }))
    );

    await expect(
      addToExistingNotebook(
        'nb1',
        [{ kind: 'panel', panel: panel('p95 latency'), isLibraryPanel: false }],
        NOTEBOOK_ENTRY_POINT.EXPLORE
      )
    ).rejects.toThrow();

    expect(NotebookAnalytics.cellAddedFromAddToNotebook).not.toHaveBeenCalled();
  });
});

describe('createNotebookWithContent', () => {
  // The modal asks for a name only, so the rest of the header is the schema's empty default: no
  // tags, and no description key at all rather than an empty one nobody wrote.
  it('creates a notebook carrying the panel under the given name, with no tags or description', async () => {
    const captured = captureCreate();

    const added = await createNotebookWithContent(
      { title: 'Checkout latency investigation' },
      [{ kind: 'panel', panel: panel('p95 latency'), isLibraryPanel: false }],
      'dashboard_panel'
    );

    expect(added).toEqual({ uid: 'nb2', title: 'Checkout latency investigation' });
    expect(captured.body!.spec).toMatchObject({ title: 'Checkout latency investigation', tags: [] });
    expect(captured.body!.spec).not.toHaveProperty('description');
    expect(Object.keys(captured.body!.spec!.elements)).toEqual(['p95-latency']);
  });

  it('attributes the panel to the source given', async () => {
    const captured = captureCreate();

    await createNotebookWithContent(
      { title: 'Untitled' },
      [{ kind: 'panel', panel: panel('Chart'), isLibraryPanel: false }],
      'plugin',
      'assistant'
    );

    expect(captured.body!.spec!.layout.spec.cells.map((cell) => cell.spec.source)).toEqual(['assistant']);
  });

  // A k8s create body carries its own type; the apiserver does not infer it from the endpoint.
  it('sends a create body the apiserver can type', async () => {
    const captured = captureCreate();

    await createNotebookWithContent(
      { title: 'Untitled' },
      [{ kind: 'panel', panel: panel('Chart'), isLibraryPanel: false }],
      'dashboard_panel'
    );

    expect(captured.body!.apiVersion).toBe('dashboard.grafana.app/v2beta1');
    expect(captured.body!.kind).toBe('Notebook');
    expect(captured.body!.metadata?.generateName).toBe('n');
  });

  // The notebook exists but cannot be opened, so this is a failure rather than a link-less success:
  // there is nothing to hand the user and nothing to retry against.
  it('fails when the create response carries no name', async () => {
    captureCreate(null);

    await expect(
      createNotebookWithContent(
        { title: 'Untitled' },
        [{ kind: 'panel', panel: panel('Chart'), isLibraryPanel: false }],
        'dashboard_panel'
      )
    ).rejects.toThrow(/carried no name/);
  });

  it('describes the panel when the new notebook holds exactly one, alongside text', async () => {
    captureCreate();

    await createNotebookWithContent(
      { title: 'Untitled' },
      [
        { kind: 'markdown', text: 'Latency rose.' },
        { kind: 'panel', panel: panel('Chart'), isLibraryPanel: true },
      ],
      'plugin'
    );

    expect(NotebookAnalytics.created).toHaveBeenCalledWith(
      'nb2',
      'plugin',
      2,
      { panel: panel('Chart'), isLibraryPanel: true },
      false,
      'other_plugin'
    );
  });

  it('describes no panel when the new notebook holds several', async () => {
    captureCreate();

    await createNotebookWithContent(
      { title: 'Untitled' },
      [
        { kind: 'panel', panel: panel('A') },
        { kind: 'panel', panel: panel('B') },
      ],
      'plugin'
    );

    expect(NotebookAnalytics.created).toHaveBeenCalledWith('nb2', 'plugin', 2, undefined, false, 'other_plugin');
  });

  it('passes on whether the modal locked the time range', async () => {
    captureCreate();

    await createNotebookWithContent(
      { title: 'Untitled' },
      [{ kind: 'panel', panel: panel('Chart'), isLibraryPanel: false }],
      'explore',
      'user',
      true
    );

    expect(NotebookAnalytics.created).toHaveBeenCalledWith(
      'nb2',
      'explore',
      1,
      { panel: panel('Chart'), isLibraryPanel: false },
      true
    );
  });

  it('reports the caller entry point and cell count once the notebook is created', async () => {
    captureCreate();

    await createNotebookWithContent(
      { title: 'Untitled' },
      [{ kind: 'panel', panel: panel('Chart'), isLibraryPanel: false }],
      'explore'
    );

    expect(NotebookAnalytics.created).toHaveBeenCalledTimes(1);
    expect(NotebookAnalytics.created).toHaveBeenCalledWith(
      'nb2',
      'explore',
      1,
      { panel: panel('Chart'), isLibraryPanel: false },
      false
    );
    // The cell arrived as part of the creation, and `created` already carries the cell count.
    expect(NotebookAnalytics.cellAddedFromAddToNotebook).not.toHaveBeenCalled();
  });

  it('does not report a create when the write fails', async () => {
    captureCreate(null);

    await expect(
      createNotebookWithContent(
        { title: 'Untitled' },
        [{ kind: 'panel', panel: panel('Chart'), isLibraryPanel: false }],
        'explore'
      )
    ).rejects.toThrow();

    expect(NotebookAnalytics.created).not.toHaveBeenCalled();
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

describe('addPanelFailureReason', () => {
  it('blames the panel build when the panel never got built', () => {
    expect(addPanelFailureReason(new Error('nothing to serialize'), false)).toBe('build_failed');
  });

  // A conflict is the only failure a retry fixes, so it is reported on its own.
  it('names a conflict on its own', () => {
    expect(addPanelFailureReason(new NotebookConflictError('modified'), true)).toBe('conflict');
  });

  it('calls any other error after the panel was built a write failure', () => {
    expect(addPanelFailureReason(new Error('notebook is too large'), true)).toBe('write_failed');
  });
});
