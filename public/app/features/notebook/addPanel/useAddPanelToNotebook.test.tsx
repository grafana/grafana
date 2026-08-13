import { HttpResponse, http, type PathParams } from 'msw';
import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { defaultPanelKind, type PanelKind, type Spec as NotebookSpec } from '../types';

import { addPanelErrorMessage, useAddPanelToNotebook } from './useAddPanelToNotebook';

const NOTEBOOKS_URL = '/apis/dashboard.grafana.app/v2beta1/namespaces/:namespace/notebooks';
const NOTEBOOK_URL = `${NOTEBOOKS_URL}/:name`;

// The api clients issue their requests through the backend service, which msw then intercepts.
setBackendSrv(backendSrv);
setupMockServer();

function panel(title: string): PanelKind {
  const base = defaultPanelKind();
  return { ...base, spec: { ...base.spec, id: 1, title } };
}

function existingNotebook() {
  return {
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
  metadata?: { name?: string; resourceVersion?: string; generateName?: string };
  spec?: NotebookSpec;
}

interface CapturedRequest {
  body?: NotebookRequestBody;
}

// The hook is nothing but RTK Query hooks, so it needs the store the app provides.
const wrapper = getWrapper({ renderWithRouter: false });

function renderAddPanel() {
  return renderHook(() => useAddPanelToNotebook(), { wrapper });
}

describe('useAddPanelToNotebook', () => {
  describe('addToExisting', () => {
    it('writes back the fetched notebook with the panel appended', async () => {
      const captured: CapturedRequest = {};
      server.use(
        http.get(NOTEBOOK_URL, () => HttpResponse.json(existingNotebook())),
        http.put<PathParams, NotebookRequestBody>(NOTEBOOK_URL, async ({ request }) => {
          captured.body = await request.json();
          return HttpResponse.json(captured.body);
        })
      );

      const { result } = renderAddPanel();

      const added = await act(() => result.current.addToExisting('nb1', panel('p95 latency')));

      expect(added).toEqual({ uid: 'nb1', title: 'Checkout error spike' });
      await waitFor(() => expect(captured.body).toBeDefined());
      expect(Object.keys(captured.body!.spec!.elements)).toEqual(['p95-latency']);
      expect(captured.body!.spec!.layout.spec.cells).toHaveLength(1);
      // Everything the notebook already had survives the round trip.
      expect(captured.body!.spec!.tags).toEqual(['incident']);
    });

    // Without this the apiserver has nothing to compare against and a concurrent edit is silently
    // overwritten instead of rejected.
    it('sends the resourceVersion it read back with the write', async () => {
      const captured: CapturedRequest = {};
      server.use(
        http.get(NOTEBOOK_URL, () => HttpResponse.json(existingNotebook())),
        http.put<PathParams, NotebookRequestBody>(NOTEBOOK_URL, async ({ request }) => {
          captured.body = await request.json();
          return HttpResponse.json(captured.body);
        })
      );

      const { result } = renderAddPanel();
      await act(() => result.current.addToExisting('nb1', panel('p95 latency')));

      await waitFor(() => expect(captured.body).toBeDefined());
      expect(captured.body!.metadata?.resourceVersion).toBe('42');
    });

    it('rejects with the conflict message when the notebook moved on', async () => {
      server.use(
        http.get(NOTEBOOK_URL, () => HttpResponse.json(existingNotebook())),
        http.put(NOTEBOOK_URL, () => HttpResponse.json({ message: 'conflict' }, { status: 409 }))
      );

      const { result } = renderAddPanel();

      await expect(act(() => result.current.addToExisting('nb1', panel('p95 latency')))).rejects.toEqual(
        expect.objectContaining({ status: 409 })
      );
    });
  });

  describe('createWithPanel', () => {
    it('creates a notebook carrying the panel, description and tags', async () => {
      const captured: CapturedRequest = {};
      server.use(
        http.post<PathParams, NotebookRequestBody>(NOTEBOOKS_URL, async ({ request }) => {
          captured.body = await request.json();
          return HttpResponse.json({ metadata: { name: 'nb2' }, spec: captured.body!.spec });
        })
      );

      const { result } = renderAddPanel();

      const added = await act(() =>
        result.current.createWithPanel(
          { title: 'Checkout latency investigation', description: 'What are you investigating?', tags: ['latency'] },
          panel('p95 latency')
        )
      );

      expect(added).toEqual({ uid: 'nb2', title: 'Checkout latency investigation' });
      await waitFor(() => expect(captured.body).toBeDefined());
      expect(captured.body!.metadata?.generateName).toBe('nb');
      expect(captured.body!.spec).toMatchObject({
        title: 'Checkout latency investigation',
        description: 'What are you investigating?',
        tags: ['latency'],
      });
      expect(Object.keys(captured.body!.spec!.elements)).toEqual(['p95-latency']);
    });

    it('omits an empty description rather than writing one the user never typed', async () => {
      const captured: CapturedRequest = {};
      server.use(
        http.post<PathParams, NotebookRequestBody>(NOTEBOOKS_URL, async ({ request }) => {
          captured.body = await request.json();
          return HttpResponse.json({ metadata: { name: 'nb2' }, spec: captured.body!.spec });
        })
      );

      const { result } = renderAddPanel();
      await act(() => result.current.createWithPanel({ title: 'Untitled', description: '', tags: [] }, panel('Chart')));

      await waitFor(() => expect(captured.body).toBeDefined());
      expect(captured.body!.spec).not.toHaveProperty('description');
    });
  });
});

describe('addPanelErrorMessage', () => {
  it('names the conflict so the user knows retrying will work', () => {
    expect(addPanelErrorMessage({ status: 409, data: {} })).toContain('changed while you were adding');
  });

  it.each([{ status: 500, data: {} }, { status: 'FETCH_ERROR', error: 'boom' }, undefined, 'not an object'])(
    'falls back to the generic message for %p',
    (error) => {
      expect(addPanelErrorMessage(error)).toBe('Failed to add the panel to the notebook');
    }
  );
});
