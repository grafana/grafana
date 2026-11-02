import userEvent from '@testing-library/user-event';
import { render, screen } from 'test/test-utils';

import { useScopes } from '@grafana/runtime';

import { useScopesServices } from '../ScopesContextProvider';

import { ScopesDashboardsTreeSearch } from './ScopesDashboardsTreeSearch';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useScopes: jest.fn(),
}));

jest.mock('../ScopesContextProvider', () => ({
  ...jest.requireActual('../ScopesContextProvider'),
  useScopesServices: jest.fn(),
}));

const mockUseScopes = jest.mocked(useScopes);
const mockUseScopesServices = jest.mocked(useScopesServices);

describe('ScopesDashboardsTreeSearch', () => {
  const toggleDrawer = jest.fn();

  beforeEach(() => {
    mockUseScopes.mockReturnValue({
      state: { drawerOpened: true },
    } as ReturnType<typeof useScopes>);
    mockUseScopesServices.mockReturnValue({
      scopesService: {},
      scopesSelectorService: {},
      scopesDashboardsService: { toggleDrawer },
    } as unknown as ReturnType<typeof useScopesServices>);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows the navigation-pane toggle by default and wires it to toggleDrawer', async () => {
    render(<ScopesDashboardsTreeSearch disabled={false} query="" onChange={() => {}} />);

    const toggleButton = screen.getByRole('button', { name: /suggested dashboards list/i });
    expect(toggleButton).toBeInTheDocument();

    await userEvent.click(toggleButton);

    expect(toggleDrawer).toHaveBeenCalled();
  });

  it('hides the navigation-pane toggle when showNavigationToggle is false', () => {
    render(<ScopesDashboardsTreeSearch disabled={false} query="" onChange={() => {}} showNavigationToggle={false} />);

    expect(screen.queryByRole('button', { name: /suggested dashboards list/i })).not.toBeInTheDocument();
  });
});
