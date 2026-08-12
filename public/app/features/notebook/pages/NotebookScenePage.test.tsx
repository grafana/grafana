import { act, render, screen } from 'test/test-utils';

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
    // Wrap in act() because setTestFlags fires OpenFeature events that trigger React state
    // updates while the component is still mounted.
    await act(async () => {
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

  describe('edit mode from the url', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    function buildScene() {
      return new NotebookScene({
        title: 'Checkout latency investigation',
        uid: 'nb-1',
        body: new NotebookLayoutManager({ cells: [] }),
        $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
        timePicker: new SceneTimePicker({}),
        refreshPicker: new SceneRefreshPicker({}),
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
  });
});
