import { act, render, screen } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { setTestFlags } from '@grafana/test-utils/unstable';

import VariablesManagementPage from './VariablesManagementPage';

// The route is registered unconditionally, so the page itself enforces this OpenFeature flag.
const GLOBAL_DASHBOARD_VARIABLES_FLAG = 'globalDashboardVariables';

jest.mock('./api', () => ({
  ...jest.requireActual('./api'),
  useListAllVariablesQuery: () => ({
    data: [],
    isLoading: false,
    isError: false,
    error: undefined,
  }),
  useFolderTitles: () => ({}),
}));

describe('VariablesManagementPage', () => {
  afterEach(async () => {
    // Wrap in act() because setTestFlags fires OpenFeature events that trigger React state
    // updates while the component is still mounted.
    await act(async () => {
      setTestFlags({});
    });
  });

  it('renders the not-found page when the feature flag is off', async () => {
    setTestFlags({ [GLOBAL_DASHBOARD_VARIABLES_FLAG]: false });

    render(<VariablesManagementPage />);

    expect(await screen.findByTestId(selectors.components.EntityNotFound.container)).toBeInTheDocument();
  });

  it('renders the variables page when the feature flag is on', async () => {
    setTestFlags({ [GLOBAL_DASHBOARD_VARIABLES_FLAG]: true });

    render(<VariablesManagementPage />);

    // With the flag on the page proceeds to the empty state rather than short-circuiting to
    // EntityNotFound (the Page chrome may still say "Page not found" when navId is absent
    // from the test nav index — that is unrelated to the feature-flag gate).
    expect(await screen.findByText("You haven't created any variables yet")).toBeInTheDocument();
    expect(screen.queryByTestId(selectors.components.EntityNotFound.container)).not.toBeInTheDocument();
  });
});
