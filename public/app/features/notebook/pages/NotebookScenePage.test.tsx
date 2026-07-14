import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { useFlagDashboardNotebooks } from '@grafana/runtime/internal';

import { NotebookScenePage } from './NotebookScenePage';

// The route is registered unconditionally, so the page itself enforces the feature flag via the
// OpenFeature hook. Mock the hook to drive both gate branches.
jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  useFlagDashboardNotebooks: jest.fn(),
}));

describe('NotebookScenePage', () => {
  it('renders the not-found page when the feature flag is off', () => {
    jest.mocked(useFlagDashboardNotebooks).mockReturnValue(false);

    render(<NotebookScenePage />);

    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });

  it('renders the notebook page and loads when the feature flag is on', () => {
    jest.mocked(useFlagDashboardNotebooks).mockReturnValue(true);

    render(<NotebookScenePage />);

    // With the flag on the page proceeds to load (its real loading container renders) rather
    // than short-circuiting to not-found.
    expect(screen.getByTestId('notebook-scene-page')).toBeInTheDocument();
    expect(screen.queryByText('Page not found')).not.toBeInTheDocument();
  });
});
