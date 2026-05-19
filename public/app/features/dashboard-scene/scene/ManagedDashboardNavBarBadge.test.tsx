import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { config, isFetchError } from '@grafana/runtime';
import { ManagerKind } from 'app/features/apiserver/types';

import { DashboardScene } from './DashboardScene';
import { ManagedDashboardNavBarBadge } from './ManagedDashboardNavBarBadge';

const mockUseGetRepositoryQuery = jest.fn();

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetRepositoryQuery: () => mockUseGetRepositoryQuery(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  isFetchError: jest.fn(),
}));

type RepositoryQueryState = {
  data?: { spec?: { title?: string } };
  isError: boolean;
  error?: unknown;
};

function mockRepositoryQueryState(state: Partial<RepositoryQueryState> = {}) {
  const defaultState: RepositoryQueryState = {
    data: undefined,
    isError: false,
    error: undefined,
  };

  mockUseGetRepositoryQuery.mockReturnValue({
    ...defaultState,
    ...state,
  });
}

function buildDashboard(kind?: ManagerKind, id?: string): DashboardScene {
  const dashboard = new DashboardScene({
    title: 'test dashboard',
    uid: 'dash-1',
  });

  jest.spyOn(dashboard, 'getManagerKind').mockReturnValue(kind);
  jest.spyOn(dashboard, 'getManagerIdentity').mockReturnValue(id);

  return dashboard;
}

describe('ManagedDashboardNavBarBadge', () => {
  beforeEach(() => {
    config.featureToggles.provisioning = true;
    jest.mocked(isFetchError).mockReturnValue(false);
    mockRepositoryQueryState();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns null and skips repo query when manager kind is missing', () => {
    const dashboard = buildDashboard(undefined, undefined);
    const { container } = render(<ManagedDashboardNavBarBadge dashboard={dashboard} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders orphaned repository tooltip for 404 repo fetch errors', async () => {
    jest.mocked(isFetchError).mockReturnValue(true);
    mockRepositoryQueryState({
      isError: true,
      error: { status: 404 },
    });

    const dashboard = buildDashboard(ManagerKind.Repo, undefined);
    const user = userEvent.setup();

    render(<ManagedDashboardNavBarBadge dashboard={dashboard} />);

    const badgeIcon = screen.getByTestId('icon-exclamation-triangle');
    await user.hover(badgeIcon);

    expect(await screen.findByText('Repository not found')).toBeInTheDocument();
  });

  it('renders managed repository tooltip when repo exists', async () => {
    mockRepositoryQueryState({
      data: { spec: { title: 'Main Repo' } },
      isError: false,
    });

    const dashboard = buildDashboard(ManagerKind.Repo, 'repo-main');
    const user = userEvent.setup();

    render(<ManagedDashboardNavBarBadge dashboard={dashboard} />);

    const badgeIcon = screen.getByTestId('icon-exchange-alt');
    await user.hover(badgeIcon);

    expect(await screen.findByText('Managed by: Repository Main Repo')).toBeInTheDocument();
  });
});
