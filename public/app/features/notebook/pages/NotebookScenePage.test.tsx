import { act, render, screen, waitFor } from 'test/test-utils';

import { locationService } from '@grafana/runtime';
import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';

import { NotebookScene } from '../scene/NotebookScene';
import { NotebookLayoutManager } from '../scene/layout-notebook/NotebookLayoutManager';

import { getNotebookPageStateManager } from './NotebookPageStateManager';
import { NotebookScenePage } from './NotebookScenePage';

// The route is registered unconditionally, so the page itself enforces this OpenFeature flag.
const NOTEBOOKS_FLAG = 'dashboard.notebooks';

describe('NotebookScenePage', () => {
  afterEach(async () => {
    // Wrap in act() because both of these publish state while a component is still mounted:
    // setTestFlags fires OpenFeature events, and clearing the state manager drops its scene. The
    // manager is a module-level singleton, so a scene seeded by one test would otherwise still be
    // there for the next one.
    await act(async () => {
      getNotebookPageStateManager().clearState();
      setTestFlags({});
    });
  });

  it('renders the not-found page when the feature flag is off', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: false });

    render(<NotebookScenePage />);

    expect(await screen.findByText('Page not found')).toBeInTheDocument();
  });

  it('renders the notebook page and loads when the feature flag is on', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });

    render(<NotebookScenePage />);

    // With the flag on the page proceeds to load (its real loading container renders) rather
    // than short-circuiting to not-found.
    expect(await screen.findByTestId('notebook-scene-page')).toBeInTheDocument();
    expect(screen.queryByText('Page not found')).not.toBeInTheDocument();
  });

  // The toolbar's own test renders it in isolation, so nothing else here would notice if the page
  // stopped mounting it. Seeds a loaded scene straight into the state manager so the document
  // branch renders without an API round-trip.
  it('renders the toolbar once a notebook is loaded', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    const stateManager = getNotebookPageStateManager();

    await act(async () => {
      stateManager.setState({
        isLoading: false,
        scene: new NotebookScene({
          title: 'Checkout latency investigation',
          uid: 'nb-1',
          body: new NotebookLayoutManager({ cells: [] }),
          $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
          timePicker: new SceneTimePicker({}),
          refreshPicker: new SceneRefreshPicker({}),
        }),
      });
      render(<NotebookScenePage />);
    });

    expect(await screen.findByRole('button', { name: 'Copy link' })).toBeInTheDocument();
  });

  // Nothing is mocked here: building a blank notebook needs no request, which is the point of it.
  describe('the blank new-notebook route', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('renders an empty notebook that has no resource behind it', async () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
      setTestFlags({ [NOTEBOOKS_FLAG]: true });

      render(<NotebookScenePage />, { historyOptions: { initialEntries: ['/notebooks/new'] } });

      // The scene rendered, so this is the document rather than the loading or not-found branch.
      expect(await screen.findByRole('radio', { name: 'Edit' })).toBeInTheDocument();
      expect(getNotebookPageStateManager().state.scene?.state.uid).toBeUndefined();
      // Copying a link to a notebook and exporting one both need a notebook that exists, so the
      // actions are refused until the first save creates it. The bar itself is rendered anyway: it
      // used to be hidden, and then it appeared under whoever was typing and shifted the document.
      expect(screen.getByRole('button', { name: 'Copy link' })).toHaveAttribute('aria-disabled', 'true');
    });

    // Its first save creates the notebook, and from then on the url has to point at the real thing.
    it('points the url at the notebook once its first save created it', async () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
      setTestFlags({ [NOTEBOOKS_FLAG]: true });

      render(<NotebookScenePage />, {
        historyOptions: { initialEntries: ['/notebooks/new?edit=true&from=now-3h&to=now'] },
      });
      await screen.findByRole('radio', { name: 'Edit' });

      // What autosave does when the create comes back.
      await act(async () => {
        getNotebookPageStateManager().state.scene!.setState({ uid: 'nb-new' });
      });

      await waitFor(() => expect(locationService.getLocation().pathname).toBe('/notebooks/nb-new'));
      // The params carry over: dropping from/to would have the time range resync from nothing and lose
      // the range on screen. The scene adds timezone of its own, so this checks the ones at risk.
      const search = new URLSearchParams(locationService.getLocation().search);
      expect(search.get('edit')).toBe('true');
      expect(search.get('from')).toBe('now-3h');
      expect(search.get('to')).toBe('now');
    });

    // Replace, not push: Back has to leave the notebook, not land on the blank route that made it.
    it('replaces the blank route in history rather than pushing past it', async () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
      setTestFlags({ [NOTEBOOKS_FLAG]: true });

      render(<NotebookScenePage />, {
        historyOptions: { initialEntries: ['/notebooks', '/notebooks/new?edit=true'], initialIndex: 1 },
      });
      await screen.findByRole('radio', { name: 'Edit' });

      await act(async () => {
        getNotebookPageStateManager().state.scene!.setState({ uid: 'nb-new' });
      });
      await waitFor(() => expect(locationService.getLocation().pathname).toBe('/notebooks/nb-new'));

      await act(async () => {
        locationService.getHistory().goBack();
      });

      expect(locationService.getLocation().pathname).toBe('/notebooks');
    });

    it('opens in edit mode, since a blank notebook exists only to be written into', async () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
      setTestFlags({ [NOTEBOOKS_FLAG]: true });

      render(<NotebookScenePage />, { historyOptions: { initialEntries: ['/notebooks/new?edit=true'] } });

      expect(await screen.findByRole('radio', { name: 'Edit' })).toBeChecked();
    });
  });

  describe('edit mode from the url', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    function buildScene(hideTimeControls = false) {
      return new NotebookScene({
        title: 'Checkout latency investigation',
        uid: 'nb-1',
        body: new NotebookLayoutManager({ cells: [] }),
        $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
        timePicker: new SceneTimePicker({}),
        refreshPicker: new SceneRefreshPicker({}),
        hideTimeControls,
      });
    }

    async function renderLoaded(scene: NotebookScene, url: string) {
      setTestFlags({ [NOTEBOOKS_FLAG]: true });

      await act(async () => {
        getNotebookPageStateManager().setState({ isLoading: false, scene });
        render(<NotebookScenePage />, { historyOptions: { initialEntries: [url] } });
      });
    }

    it('opens in edit mode when the url says so, so the list Edit action lands there', async () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
      const scene = buildScene();

      await renderLoaded(scene, '/notebooks/nb-1?edit=true');

      expect(scene.state.isEditing).toBe(true);
    });

    it('ignores the url for a user without edit permission', async () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
      const scene = buildScene();

      await renderLoaded(scene, '/notebooks/nb-1?edit=true');

      expect(scene.state.isEditing).toBeFalsy();
    });

    it('stays in view mode without the param', async () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
      const scene = buildScene();

      await renderLoaded(scene, '/notebooks/nb-1');

      expect(scene.state.isEditing).toBeFalsy();
    });

    // The page state manager caches scenes per uid, so reopening a notebook can hand back one left
    // in edit mode. The url is what decides the mode at load, so it has to be able to clear it.
    it('clears edit mode carried over on a cached scene', async () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
      const scene = buildScene();
      scene.onEnterEditMode();

      await renderLoaded(scene, '/notebooks/nb-1');

      expect(scene.state.isEditing).toBe(false);
    });

    // Edit mode syncs through the scene, so the page has to mount UrlSyncContextProvider for every
    // notebook. It used to skip it when the time controls were hidden, on the grounds that such a
    // notebook had no url state — which stopped being true once edit mode moved onto the scene.
    it('still honours the url for a notebook with the time controls hidden', async () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
      const scene = buildScene(true);

      await renderLoaded(scene, '/notebooks/nb-1?edit=true');

      expect(scene.state.isEditing).toBe(true);
    });
  });
});
