import { act, render, screen } from 'test/test-utils';

import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';

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
});
