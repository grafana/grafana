import { act, render, screen } from 'test/test-utils';

import { setTestFlags } from '@grafana/test-utils/unstable';

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
});
