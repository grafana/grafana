import { configureStore } from '@reduxjs/toolkit';
import { HttpResponse, delay, http } from 'msw';
import { type UnknownAction } from 'redux';

import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { dashboardAPIv2beta1 } from 'app/api/clients/dashboard/v2beta1';
import { backendSrv } from 'app/core/services/backend_srv';
import { type Resource } from 'app/features/apiserver/types';

import { NotebookAnalytics } from '../analytics/main';
import { NotebookScene } from '../scene/NotebookScene';
import { type Spec as NotebookSpec, defaultSpec as defaultNotebookSpec } from '../types';

import { NotebookPageStateManager } from './NotebookPageStateManager';

jest.mock('../analytics/main', () => ({ NotebookAnalytics: { loaded: jest.fn() } }));

const NOTEBOOK_URL = '/apis/dashboard.grafana.app/v2beta1/namespaces/:namespace/notebooks/:name';

/** Long enough for a request made after this one to answer first. */
const SLOW_RESPONSE_MS = 50;

// The api client issues its requests through the backend service, which msw then intercepts.
setBackendSrv(backendSrv);
setupMockServer();

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

function notebookResource(name = 'nb-1', generation = 1): Resource<NotebookSpec> {
  return {
    apiVersion: 'dashboard.grafana.app/v2beta1',
    kind: 'Notebook',
    metadata: { name, resourceVersion: '1', generation, creationTimestamp: '2026-07-01T00:00:00Z' },
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

/** What the network was actually asked for, so a test can show nothing was fetched. */
let requested: string[] = [];

function notebookHandler(respond: (name: string) => Response | Promise<Response>, options?: { once: boolean }) {
  return http.get(
    NOTEBOOK_URL,
    async ({ params }) => {
      const name = String(params.name);
      requested.push(name);
      return respond(name);
    },
    options
  );
}

/** Serves whichever notebook is asked for, at generation 1 unless one is listed otherwise. */
function serveNotebooks(generations: Record<string, number> = {}) {
  server.use(notebookHandler((name) => HttpResponse.json(notebookResource(name, generations[name] ?? 1))));
}

/** One response per generation, in order, so a reload can see the resource move underneath it. */
function serveGenerations(...generations: number[]) {
  server.use(
    ...generations.map((generation) =>
      notebookHandler((name) => HttpResponse.json(notebookResource(name, generation)), { once: true })
    )
  );
}

/** Holds `nb-slow` back, so a request made after it lands first. */
function serveNotebooksHoldingSlowOne() {
  server.use(
    notebookHandler(async (name) => {
      if (name === 'nb-slow') {
        await delay(SLOW_RESPONSE_MS);
      }
      return HttpResponse.json(notebookResource(name));
    })
  );
}

describe('NotebookPageStateManager', () => {
  beforeEach(() => {
    testStore = createTestStore();
    requested = [];
    jest.mocked(NotebookAnalytics.loaded).mockClear();
    // The scene cache is module state, shared by every manager so that one notebook on screen twice
    // is one scene and therefore one autosave. That makes it outlive a `new` manager, so each case
    // has to start from empty or it inherits the previous one's scenes and reads as a cache hit.
    new NotebookPageStateManager({ isLoading: false }).clearSceneCache();
  });

  it('fetches the notebook and builds a NotebookScene', async () => {
    serveNotebooks();
    const manager = new NotebookPageStateManager({ isLoading: false });

    await manager.loadNotebook('nb-1');

    expect(manager.state.loadError).toBeUndefined();
    expect(manager.state.isLoading).toBe(false);
    expect(manager.state.scene).toBeInstanceOf(NotebookScene);
    expect(manager.state.scene?.state.title).toBe('My notebook');
    expect(manager.state.scene?.state.body.state.cells).toHaveLength(1);
  });

  it('reuses the cached scene when the resource generation is unchanged', async () => {
    serveNotebooks();
    const manager = new NotebookPageStateManager({ isLoading: false });

    await manager.loadNotebook('nb-1');
    const first = manager.state.scene?.state.key;
    await manager.loadNotebook('nb-1');

    expect(manager.state.scene?.state.key).toBe(first);
  });

  it("reuses the cached scene when the only thing that moved the generation was this page's own save", async () => {
    serveGenerations(1, 2);
    const manager = new NotebookPageStateManager({ isLoading: false });

    await manager.loadNotebook('nb-1');
    const first = manager.state.scene?.state.key;
    manager.state.scene?.autosave.setState({ savedGeneration: 2 });
    // Emptied so the second load actually reaches the server, which is what happens once the query
    // layer's own entry expires.
    testStore.dispatch(dashboardAPIv2beta1.util.resetApiState());

    await manager.loadNotebook('nb-1');

    expect(manager.state.scene?.state.key).toBe(first);
  });

  it('rebuilds the scene when the server moved past what this page saved', async () => {
    serveGenerations(1, 3);
    const manager = new NotebookPageStateManager({ isLoading: false });

    await manager.loadNotebook('nb-1');
    const first = manager.state.scene?.state.key;
    manager.state.scene?.autosave.setState({ savedGeneration: 2 });
    testStore.dispatch(dashboardAPIv2beta1.util.resetApiState());

    await manager.loadNotebook('nb-1');

    expect(manager.state.scene).toBeInstanceOf(NotebookScene);
    expect(manager.state.scene?.state.key).not.toBe(first);
  });

  it('keeps the cached scene when the query layer answers from before this page saved', async () => {
    // No reset here: the query layer still holds the response from the first load, so the second one is
    // answered with the generation from before the save. Rebuilding from that would put the notebook
    // back to how it looked before the edits autosave had already persisted.
    serveNotebooks();
    const manager = new NotebookPageStateManager({ isLoading: false });

    await manager.loadNotebook('nb-1');
    const first = manager.state.scene?.state.key;
    manager.state.scene?.autosave.setState({ savedGeneration: 2 });

    await manager.loadNotebook('nb-1');

    expect(manager.state.scene?.state.key).toBe(first);
  });

  it('rebuilds the scene after removeSceneCache, even at an unchanged generation', async () => {
    serveNotebooks();
    const manager = new NotebookPageStateManager({ isLoading: false });

    await manager.loadNotebook('nb-1');
    const first = manager.state.scene?.state.key;
    manager.removeSceneCache('nb-1');
    await manager.loadNotebook('nb-1');

    expect(manager.state.scene).toBeInstanceOf(NotebookScene);
    expect(manager.state.scene?.state.key).not.toBe(first);
  });

  it('rebuilds every notebook after clearSceneCache', async () => {
    serveNotebooks();
    const manager = new NotebookPageStateManager({ isLoading: false });

    await manager.loadNotebook('nb-1');
    const firstOne = manager.state.scene?.state.key;
    await manager.loadNotebook('nb-2');
    const firstTwo = manager.state.scene?.state.key;
    // Guards the handler: if both loads resolved to the same cache entry the test below would pass
    // trivially without ever proving two entries were cleared.
    expect(firstTwo).not.toBe(firstOne);

    manager.clearSceneCache();

    await manager.loadNotebook('nb-1');
    expect(manager.state.scene?.state.key).not.toBe(firstOne);
    await manager.loadNotebook('nb-2');
    expect(manager.state.scene?.state.key).not.toBe(firstTwo);
  });

  it('ignores removeSceneCache for an unknown uid and leaves other entries cached', async () => {
    serveNotebooks();
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
    serveNotebooksHoldingSlowOne();
    const manager = new NotebookPageStateManager({ isLoading: false });

    const slow = manager.loadNotebook('nb-slow');
    const fast = manager.loadNotebook('nb-fast');
    await Promise.all([fast, slow]);

    expect(manager.state.scene?.state.uid).toBe('nb-fast');
    expect(manager.state.loadError).toBeUndefined();
  });

  it('ignores a superseded failure so a stale error cannot replace a loaded notebook', async () => {
    server.use(
      notebookHandler(async (name) => {
        if (name === 'nb-slow') {
          await delay(SLOW_RESPONSE_MS);
          return HttpResponse.json({ message: 'gone' }, { status: 404 });
        }
        return HttpResponse.json(notebookResource(name));
      })
    );
    const manager = new NotebookPageStateManager({ isLoading: false });

    const slow = manager.loadNotebook('nb-slow');
    const fast = manager.loadNotebook('nb-fast');
    await Promise.all([fast, slow]);

    expect(manager.state.loadError).toBeUndefined();
    expect(manager.state.scene?.state.uid).toBe('nb-fast');
  });

  describe('loaded event', () => {
    it('fires once on a fresh load, reporting it was not cached', async () => {
      serveNotebooks();
      const manager = new NotebookPageStateManager({ isLoading: false });

      await manager.loadNotebook('nb-1');

      expect(jest.mocked(NotebookAnalytics.loaded)).toHaveBeenCalledTimes(1);
      expect(jest.mocked(NotebookAnalytics.loaded)).toHaveBeenCalledWith(expect.anything(), false);
    });

    it('fires again on a second navigation to a cached scene, reporting it was cached', async () => {
      serveNotebooks();
      const manager = new NotebookPageStateManager({ isLoading: false });

      await manager.loadNotebook('nb-1');
      await manager.loadNotebook('nb-1');

      expect(jest.mocked(NotebookAnalytics.loaded)).toHaveBeenCalledTimes(2);
      expect(jest.mocked(NotebookAnalytics.loaded)).toHaveBeenNthCalledWith(2, expect.anything(), true);
    });

    it('does not fire when a blank notebook adopts its own uid instead of being fetched', async () => {
      serveNotebooks();
      const manager = new NotebookPageStateManager({ isLoading: false });

      manager.newNotebook();
      const blank = manager.state.scene!;
      blank.setState({ uid: 'nb-new' });

      await manager.loadNotebook('nb-new');

      expect(jest.mocked(NotebookAnalytics.loaded)).not.toHaveBeenCalled();
    });

    it('fires only for the load that wins a superseded race', async () => {
      serveNotebooksHoldingSlowOne();
      const manager = new NotebookPageStateManager({ isLoading: false });

      const slow = manager.loadNotebook('nb-slow');
      const fast = manager.loadNotebook('nb-fast');
      await Promise.all([fast, slow]);

      expect(jest.mocked(NotebookAnalytics.loaded)).toHaveBeenCalledTimes(1);
      expect(manager.state.scene?.state.uid).toBe('nb-fast');
    });
  });

  describe('newNotebook', () => {
    /** Nobody is asked for a name, so the notebook arrives with one it made up. */
    const TITLE_PATTERN = /^Notebook #[a-z0-9]{12}$/;

    it('builds an empty notebook with no resource behind it and nothing fetched', () => {
      serveNotebooks();
      const manager = new NotebookPageStateManager({ isLoading: false });

      manager.newNotebook();

      expect(manager.state.scene?.state.uid).toBeUndefined();
      expect(manager.state.scene?.state.title).toMatch(TITLE_PATTERN);
      expect(manager.state.scene?.state.body.state.cells).toEqual([]);
      expect(manager.state.isLoading).toBe(false);
      expect(manager.state.loadError).toBeUndefined();
      expect(requested).toEqual([]);
    });

    // The reason for the token at all: autosave creates these without asking for a name, so two
    // notebooks made one after the other have to be tellable apart in the list.
    it('gives each new notebook a title of its own', () => {
      serveNotebooks();
      const manager = new NotebookPageStateManager({ isLoading: false });

      manager.newNotebook();
      const first = manager.state.scene?.state.title;
      manager.newNotebook();
      const second = manager.state.scene?.state.title;

      expect(first).toMatch(TITLE_PATTERN);
      expect(second).toMatch(TITLE_PATTERN);
      expect(second).not.toBe(first);
    });

    // The scene cache is keyed by uid and a blank notebook has none, so caching it would mean every
    // blank page after the first reopened whatever the previous one was left holding.
    it('does not keep the blank notebook, so a second one starts empty again', () => {
      serveNotebooks();
      const manager = new NotebookPageStateManager({ isLoading: false });

      manager.newNotebook();
      const first = manager.state.scene;
      manager.newNotebook();

      expect(manager.state.scene).not.toBe(first);
    });

    // Clicking New notebook while a notebook is still loading. `await` does not cancel, so without
    // the sequence bump the load would resolve on top of the blank page the user is now looking at.
    it('is not replaced by a load that was already in flight', async () => {
      serveNotebooksHoldingSlowOne();
      const manager = new NotebookPageStateManager({ isLoading: false });

      const slow = manager.loadNotebook('nb-slow');
      manager.newNotebook();
      await slow;

      expect(manager.state.scene?.state.uid).toBeUndefined();
      expect(manager.state.loadError).toBeUndefined();
    });
  });

  /**
   * Once a blank notebook's first save creates it, the page navigates to the real url and loads that uid.
   * The scene being typed into has to survive that, or the caret and the undo history go with it.
   */
  describe('the blank notebook once it has been created', () => {
    it('takes up the scene already on screen instead of fetching it', async () => {
      serveNotebooks();
      const manager = new NotebookPageStateManager({ isLoading: false });

      manager.newNotebook();
      const blank = manager.state.scene!;
      // What autosave does when the create comes back.
      blank.setState({ uid: 'nb-new' });

      await manager.loadNotebook('nb-new');

      expect(manager.state.scene?.state.key).toBe(blank.state.key);
      expect(requested).toEqual([]);
      expect(manager.state.isLoading).toBe(false);
      expect(manager.state.loadError).toBeUndefined();
    });

    it('caches it, so coming back to it later does not rebuild it either', async () => {
      serveNotebooks();
      const manager = new NotebookPageStateManager({ isLoading: false });

      manager.newNotebook();
      const blank = manager.state.scene!;
      blank.setState({ uid: 'nb-new' });
      // Both of these are what a real create produces: the uid on the scene, and the generation the
      // response reported. Without the generation a later load cannot tell this scene from a stale one.
      blank.autosave.setState({ savedGeneration: 1 });
      await manager.loadNotebook('nb-new');

      manager.clearState();
      await manager.loadNotebook('nb-new');

      expect(manager.state.scene?.state.key).toBe(blank.state.key);
    });

    // Only the notebook it actually became. Anything else is a real load.
    it('still fetches a different notebook while a blank one is held', async () => {
      serveNotebooks();
      const manager = new NotebookPageStateManager({ isLoading: false });

      manager.newNotebook();
      const blank = manager.state.scene!;

      await manager.loadNotebook('nb-other');

      expect(manager.state.scene?.state.key).not.toBe(blank.state.key);
      expect(manager.state.scene?.state.uid).toBe('nb-other');
    });
  });

  // A response the query layer accepts but that carries no notebook. The manager throws its own
  // Error for it, which is a different shape from the API failure below.
  it('surfaces a response with no notebook in it as loadError instead of a scene', async () => {
    server.use(notebookHandler(() => HttpResponse.json(null)));
    const manager = new NotebookPageStateManager({ isLoading: false });

    await manager.loadNotebook('missing');

    expect(manager.state.scene).toBeUndefined();
    expect(manager.state.isLoading).toBe(false);
    expect(manager.state.loadError?.message).toBe('Notebook not found');
  });

  // RTK rejects with { status, data } rather than an Error. Both fields have to survive: the status
  // drives the 404 not-found state and the body carries the backend message.
  it('preserves the HTTP status and backend message of an API failure', async () => {
    server.use(notebookHandler(() => HttpResponse.json({ message: 'notebook not found' }, { status: 404 })));
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
