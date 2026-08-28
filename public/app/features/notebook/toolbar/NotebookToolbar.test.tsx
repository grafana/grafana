import { createMemoryHistory } from 'history';
import { act, render, screen, waitFor } from 'test/test-utils';

import { HistoryWrapper, config, locationService, setLocationService } from '@grafana/runtime';
import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { useDeleteNotebookMutation } from 'app/api/clients/dashboard/v2beta1';
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';
import { contextSrv } from 'app/core/services/context_srv';

import { getNotebookPageStateManager } from '../pages/NotebookPageStateManager';
import { NotebookScene } from '../scene/NotebookScene';
import { NotebookCellItem } from '../scene/layout-notebook/NotebookCellItem';
import { NotebookLayoutManager } from '../scene/layout-notebook/NotebookLayoutManager';

import { NotebookToolbar } from './NotebookToolbar';

jest.mock('app/api/clients/dashboard/v2beta1', () => ({
  useDeleteNotebookMutation: jest.fn(),
}));

// Stubbed because the notebook header reads its tag options from a facet on this module, which calls
// injectEndpoints on the real client as it loads - and the mock above does not provide one. The list
// page and the row menu stub it for the same reason.
jest.mock('../list/notebookSearchApi', () => ({
  useNotebookFieldFacetQuery: jest.fn(),
}));

const mockUseDeleteNotebookMutation = jest.mocked(useDeleteNotebookMutation);

/** Stands in for the delete mutation hook, whose result is awaited through `.unwrap()`. */
function setupDelete(unwrap: () => Promise<unknown> = async () => ({})) {
  const trigger = jest.fn().mockReturnValue({ unwrap });
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only the trigger and isLoading are used
  mockUseDeleteNotebookMutation.mockReturnValue([trigger, { isLoading: false }] as unknown as ReturnType<
    typeof useDeleteNotebookMutation
  >);

  return trigger;
}

/**
 * Carries a real panel cell, not an empty layout. The export is the first caller of
 * transformNotebookSceneToSaveModel in production, so a scene with no cells would exercise the menu
 * without ever exercising the serializer or vizPanelToSchemaV2's constraints behind it.
 */
function buildScene() {
  return new NotebookScene({
    title: 'Q2 latency regression',
    uid: 'nb1',
    body: new NotebookLayoutManager({
      cells: [
        new NotebookCellItem({
          elementName: 'latency-panel',
          source: 'user',
          body: new VizPanel({ key: 'panel-1', title: 'p95 latency', pluginId: 'timeseries' }),
        }),
      ],
    }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({}),
  });
}

describe('NotebookToolbar', () => {
  const originalLocationService = locationService;
  const originalAppUrl = config.appUrl;
  const originalIsSecureContext = window.isSecureContext;

  beforeEach(() => {
    // Outside a secure context ClipboardButton falls back to document.execCommand, which jsdom
    // does not implement — the copy would fail silently and never reach the clipboard stub.
    Object.assign(window, { isSecureContext: true });
    config.appUrl = 'https://host/';
    // Every render mounts the delete hook, including the tests that never delete anything.
    setupDelete();
  });

  afterEach(() => {
    Object.assign(window, { isSecureContext: originalIsSecureContext });
    setLocationService(originalLocationService);
    config.appUrl = originalAppUrl;
  });

  /**
   * Renders, then installs a location service that carries an orgId, so the copied link has the
   * shape it has in production.
   *
   * The order matters: the test wrapper builds its own HistoryWrapper and calls setLocationService
   * while rendering, so anything installed beforehand is discarded. notebookShareUrl reads the
   * service when the button is clicked, not at render, so setting it afterwards is enough.
   */
  function setup() {
    const rendered = render(<NotebookToolbar uid="nb1" scene={buildScene()} />);

    const history = new HistoryWrapper(createMemoryHistory({ initialEntries: ['/'] }));
    history.setOrgIdGetter(() => 3);
    setLocationService(history);

    return rendered;
  }

  it('copies an absolute link to the notebook, not the in-app path', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'Copy link' }));

    // Both halves matter for a pasted link: the origin, or it is useless outside the app, and the
    // orgId, or it opens whichever org the reader happens to be in.
    expect(await navigator.clipboard.readText()).toBe('https://host/notebooks/nb1?orgId=3');
  });

  it('confirms the copy, so the single click does not look like it did nothing', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'Copy link' }));

    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  // Drives the whole path the PR made live: scene -> transformNotebookSceneToSaveModel ->
  // vizPanelToSchemaV2 -> markdown. Asserting on the menu alone would pass with the serializer broken.
  it('copies markdown built from the scene, panel and all', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: /Export/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Copy as Markdown' }));

    const markdown = await navigator.clipboard.readText();
    expect(markdown).toContain('# Q2 latency regression');
    expect(markdown).toContain('### p95 latency');
    expect(markdown).toContain('_timeseries panel_');
  });

  it('offers the export actions from a dropdown', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: /Export/ }));

    expect(await screen.findByRole('menuitem', { name: 'Copy as Markdown' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Download as .md' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Open in Cursor' })).toBeInTheDocument();
  });

  describe('Delete', () => {
    beforeEach(() => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    /**
     * Renders with a scene the test keeps a handle on, so its autosave can be watched, and installs a
     * location service afterwards so the navigation can be read off it.
     *
     * Installed after the render for the same reason as in `setup` above: the test wrapper installs
     * its own while rendering, and the toolbar reads the service when the delete is confirmed rather
     * than at render, so a later one still wins.
     */
    function setupWithScene(extra?: React.ReactNode) {
      const scene = buildScene();
      const rendered = render(
        <>
          {extra}
          <NotebookToolbar uid="nb1" scene={scene} />
        </>
      );

      const history = new HistoryWrapper(createMemoryHistory({ initialEntries: ['/notebooks/nb1'] }));
      setLocationService(history);

      return { ...rendered, scene, history };
    }

    async function confirmDelete(user: ReturnType<typeof render>['user']) {
      await user.click(screen.getByRole('button', { name: 'More actions' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
      await user.click(await screen.findByRole('button', { name: 'Delete' }));
    }

    it('deletes the notebook and leaves the page it was on', async () => {
      const trigger = setupDelete();
      const { user, history } = setupWithScene();

      await confirmDelete(user);

      await waitFor(() => {
        expect(trigger).toHaveBeenCalledWith({ name: 'nb1' });
      });
      await waitFor(() => {
        expect(history.getLocation().pathname).toBe('/notebooks');
      });
    });

    // The whole reason abandon exists. Autosave's teardown flushes, so a save still pending when the
    // page navigates away would be written back to a notebook the server has just removed - and it
    // has to be given up *before* the request, not after it comes back.
    // Autosave's teardown flushes, so a save still pending when the page navigates away would be
    // written back to a notebook the server has just removed. Giving up has to happen before we
    // leave - but only once the delete has actually landed, which is what the next test covers.
    it('gives up on saving once the delete has landed, before leaving the page', async () => {
      const trigger = setupDelete();
      const { user, scene, history } = setupWithScene();
      const abandon = jest.spyOn(scene.autosave, 'abandon');

      await confirmDelete(user);

      await waitFor(() => {
        expect(abandon).toHaveBeenCalledTimes(1);
      });
      expect(abandon.mock.invocationCallOrder[0]).toBeGreaterThan(trigger.mock.invocationCallOrder[0]);
      await waitFor(() => {
        expect(history.getLocation().pathname).toBe('/notebooks');
      });
    });

    /**
     * `abandon` is one-way: it latches a flag that `schedule` and `saveNow` both return early on, and
     * nothing clears it. Called before the request, a failed delete left the notebook on screen with
     * saving silently dead for the rest of the session - and the status forced to `idle`, so the UI
     * did not even report unsaved changes.
     */
    it('leaves saving alone when the delete fails, so the notebook is still editable', async () => {
      setupDelete(async () => {
        throw new Error('403');
      });
      const { user, scene } = setupWithScene();
      // Activated and editing, so autosave is actually watching for changes — a scene the toolbar
      // merely renders has never started its subscription and would look untouched either way.
      const deactivate = scene.activate();
      scene.onEnterEditMode();

      await confirmDelete(user);
      await waitFor(() => expect(screen.getByRole('button', { name: 'More actions' })).toBeInTheDocument());

      // The effect, not the call: an edit made after the failure still registers as unsaved work.
      // Latched, `schedule` returns early and the status stays `idle`, so nothing would ever be
      // written again and the UI would not say so either.
      act(() => scene.setState({ title: 'Edited after the failed delete' }));
      await waitFor(() => expect(scene.autosave.state.status).toBe('pending'));

      deactivate();
    });

    // The state manager caches scenes by uid, so a stale entry would rebuild the deleted notebook
    // from cache the next time this uid was opened rather than reporting it gone.
    it('drops the deleted notebook from the scene cache', async () => {
      setupDelete();
      const removeSceneCache = jest.spyOn(getNotebookPageStateManager(), 'removeSceneCache');
      const { user } = setupWithScene();

      await confirmDelete(user);

      await waitFor(() => {
        expect(removeSceneCache).toHaveBeenCalledWith('nb1');
      });
    });

    it('stays on the notebook and says so when the delete fails', async () => {
      setupDelete(async () => {
        throw new Error('403');
      });
      const { user, history } = setupWithScene(<AppNotificationList />);

      await confirmDelete(user);

      expect(await screen.findByText('Failed to delete notebook')).toBeInTheDocument();
      // Navigating away from a notebook that is still there would look like the delete worked.
      expect(history.getLocation().pathname).toBe('/notebooks/nb1');
    });

    it('offers no delete at all to a user who cannot delete dashboards', () => {
      setupDelete();
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

      setupWithScene();

      expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
      // Export is unaffected, so this is the delete permission being read and not a blanket denial.
      expect(screen.getByRole('button', { name: /Export/ })).toBeInTheDocument();
    });
  });

  /**
   * A notebook created by typing gets its uid part way through the first sentence. The bar has to be
   * there before that, or it appears under the writer and pushes the document down.
   */
  describe('before the notebook exists', () => {
    function setupUnsaved() {
      const scene = buildScene();
      scene.setState({ uid: undefined });
      return render(<NotebookToolbar uid={undefined} scene={scene} />);
    }

    it('still renders both actions, so nothing moves when the notebook is created', () => {
      setupUnsaved();

      expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Export/ })).toBeInTheDocument();
    });

    // aria-disabled rather than the disabled attribute: Grafana's Button switches to it when there is
    // a tooltip, so that the reason is reachable on an element a pointer can still reach.
    it('disables them and says why', () => {
      setupUnsaved();

      expect(screen.getByRole('button', { name: 'Copy link' })).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('button', { name: /Export/ })).toHaveAttribute('aria-disabled', 'true');
    });

    it('opens no export menu, since there is nothing to export', async () => {
      const { user } = setupUnsaved();

      await user.click(screen.getByRole('button', { name: /Export/ }));

      expect(screen.queryByRole('menuitem', { name: 'Copy as Markdown' })).not.toBeInTheDocument();
    });
  });
});
