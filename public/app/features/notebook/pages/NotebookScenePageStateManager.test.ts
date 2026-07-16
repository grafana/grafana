import { configureStore } from '@reduxjs/toolkit';
import { type UnknownAction } from 'redux';
import { of } from 'rxjs';
import { createFetchResponse } from 'test/helpers/createFetchResponse';

import { type BackendSrv, setBackendSrv } from '@grafana/runtime';
import { type Spec as NotebookSpec, defaultSpec as defaultNotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';
import { dashboardAPIv2beta1 } from 'app/api/clients/dashboard/v2beta1';
import { type Resource } from 'app/features/apiserver/types';
import { NotebookLayoutManager } from 'app/features/dashboard-scene/scene/layout-notebook/NotebookLayoutManager';
import { dispatch } from 'app/store/store';
import { DashboardRoutes } from 'app/types/dashboard';

import { buildNotebookEnvelope } from '../scene/buildNotebookEnvelope';

import { getNotebookScenePageStateManager } from './NotebookScenePageStateManager';

// The v2 transformer that super.transformResponseToScene runs reads getDataSourceSrv; the notebook
// here has no panels, so a minimal stub is enough.
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({ getInstanceSettings: jest.fn() }),
}));

// The state manager dispatches the notebook query through the app store; route that dispatch to a
// test store that carries the dashboard v2beta1 API so the RTK query actually runs.
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

function notebookResource(): Resource<NotebookSpec> {
  return {
    apiVersion: 'dashboard.grafana.app/v2beta1',
    kind: 'Notebook',
    metadata: { name: 'nb-1', resourceVersion: '1', creationTimestamp: '2026-07-01T00:00:00Z' },
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

describe('NotebookScenePageStateManager', () => {
  beforeEach(() => {
    testStore = createTestStore();
  });

  describe('fetchDashboard', () => {
    it('fetches the notebook and wraps it in a scene envelope', async () => {
      const notebook = notebookResource();
      setBackendSrv({ fetch: jest.fn().mockReturnValue(of(createFetchResponse(notebook))) } as unknown as BackendSrv);

      const rsp = await getNotebookScenePageStateManager().fetchDashboard({
        uid: 'nb-1',
        route: DashboardRoutes.Notebook,
      });

      expect(rsp?.kind).toBe('DashboardWithAccessInfo');
      expect(rsp?.spec.title).toBe('My notebook');
      expect(rsp?.spec.layout).toEqual(notebook.spec.layout);
    });

    it('propagates the error when the notebook is not found', async () => {
      // RTK resolves with { error } on a failed fetch (e.g. 404), so fetchDashboard should reject with it.
      const error = { status: 404, data: { message: 'notebook not found' } };
      jest.mocked(dispatch).mockReturnValueOnce(Promise.resolve({ error }) as unknown as UnknownAction);

      await expect(
        getNotebookScenePageStateManager().fetchDashboard({ uid: 'nb-1', route: DashboardRoutes.Notebook })
      ).rejects.toBe(error);
    });

    it('returns null when no uid is provided', async () => {
      const rsp = await getNotebookScenePageStateManager().fetchDashboard({
        uid: '',
        route: DashboardRoutes.Notebook,
      });

      expect(rsp).toBeNull();
    });
  });

  describe('transformResponseToScene', () => {
    it('marks the scene read-only and pushes title and tags onto the notebook layout', () => {
      const envelope = buildNotebookEnvelope(notebookResource());

      const scene = getNotebookScenePageStateManager().transformResponseToScene(envelope, {
        uid: 'nb-1',
        route: DashboardRoutes.Notebook,
      });

      expect(scene?.state.meta.isEmbedded).toBe(true);

      const body = scene?.state.body;
      expect(body).toBeInstanceOf(NotebookLayoutManager);
      expect((body as NotebookLayoutManager).state.title).toBe('My notebook');
      expect((body as NotebookLayoutManager).state.tags).toEqual(['incident']);
    });

    it('hides the time controls when the notebook hides the time picker', () => {
      const notebook = notebookResource();
      notebook.spec.timeSettings = { ...notebook.spec.timeSettings, hideTimepicker: true };
      // Distinct uid: transformResponseToScene caches the scene by uid on the shared manager, so
      // reusing another test's uid would return its cached (hideTimeControls: false) scene.
      notebook.metadata.name = 'nb-hidden-timepicker';

      const scene = getNotebookScenePageStateManager().transformResponseToScene(buildNotebookEnvelope(notebook), {
        uid: 'nb-hidden-timepicker',
        route: DashboardRoutes.Notebook,
      });

      // The page keys the picker + URL sync off this, so the notebook's hideTimepicker must reach it.
      expect(scene?.state.controls?.state.hideTimeControls).toBe(true);
    });
  });
});
