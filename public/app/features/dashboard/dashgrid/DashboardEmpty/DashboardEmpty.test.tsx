import { act, fireEvent, render, screen } from '@testing-library/react';

import { config, locationService, reportInteraction } from '@grafana/runtime';
import { defaultDashboard } from '@grafana/schema';

import { createDashboardModelFixture } from '../../state/__fixtures__/dashboardFixtures';
import { onCreateNewPanel, onImportDashboard, onAddLibraryPanel } from '../../utils/dashboard';

import DashboardEmpty, { type Props } from './DashboardEmpty';

jest.mock('app/types/store', () => ({
  ...jest.requireActual('app/types/store'),
  useDispatch: () => jest.fn(),
  useSelector: () => jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    partial: jest.fn(),
  },
  reportInteraction: jest.fn(),
}));

jest.mock('app/features/dashboard/utils/dashboard', () => ({
  onCreateNewPanel: jest.fn(),
  onImportDashboard: jest.fn(),
  onAddLibraryPanel: jest.fn(),
}));

jest.mock('app/features/provisioning/hooks/useGetResourceRepositoryView', () => ({
  useGetResourceRepositoryView: jest.fn(() => ({
    isReadOnlyRepo: false,
    isInstanceManaged: false,
    isLoading: false,
  })),
}));

const mockUseGetResourceRepositoryView = jest.mocked(
  require('app/features/provisioning/hooks/useGetResourceRepositoryView').useGetResourceRepositoryView
);

const mockSearchParams = new URLSearchParams();
jest.spyOn(require('react-router-dom-v5-compat'), 'useSearchParams').mockReturnValue([mockSearchParams]);

function setup(options?: Partial<Props>) {
  const props = {
    dashboard: createDashboardModelFixture(defaultDashboard),
    canCreate: options?.canCreate ?? true,
  };
  const { rerender } = render(<DashboardEmpty dashboard={props.dashboard} canCreate={props.canCreate} />);

  return rerender;
}

beforeEach(() => {
  jest.clearAllMocks();
  // Reset the mock to default state
  mockUseGetResourceRepositoryView.mockReturnValue({
    isReadOnlyRepo: false,
    isInstanceManaged: false,
    isLoading: false,
  });
});

it('renders page with correct title for an empty dashboard', () => {
  setup();

  expect(screen.getByText('your new dashboard', { exact: false })).toBeInTheDocument();
});

it('renders with all buttons enabled when canCreate is true', () => {
  setup();

  expect(screen.getByRole('button', { name: 'Add visualization' })).not.toBeDisabled();
  expect(screen.getByRole('button', { name: 'Import dashboard' })).not.toBeDisabled();
  expect(screen.getByRole('button', { name: 'Add library panel' })).not.toBeDisabled();
});

it('renders with all buttons disabled when canCreate is false', () => {
  setup({ canCreate: false });

  expect(screen.getByRole('button', { name: 'Add visualization' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Import dashboard' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Add library panel' })).toBeDisabled();
});

it('creates new visualization when clicked Add visualization', () => {
  setup();

  act(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Add visualization' }));
  });

  expect(reportInteraction).toHaveBeenCalledWith('dashboards_emptydashboard_clicked', {
    item: 'add_visualization',
    isDynamicDashboard: false,
  });
  expect(locationService.partial).toHaveBeenCalled();
  expect(locationService.partial).toHaveBeenCalledWith({ editPanel: undefined, firstPanel: true });
  expect(onCreateNewPanel).toHaveBeenCalled();
});

it('open import dashboard when clicked Import dashboard', () => {
  setup();

  act(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Import dashboard' }));
  });

  expect(reportInteraction).toHaveBeenCalledWith('dashboards_emptydashboard_clicked', {
    item: 'import_dashboard',
    isDynamicDashboard: false,
  });
  expect(onImportDashboard).toHaveBeenCalled();
});

it('adds a library panel when clicked Add library panel', () => {
  setup();

  act(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Add library panel' }));
  });

  expect(reportInteraction).toHaveBeenCalledWith('dashboards_emptydashboard_clicked', {
    item: 'import_from_library',
    isDynamicDashboard: false,
  });
  expect(locationService.partial).not.toHaveBeenCalled();
  expect(onAddLibraryPanel).toHaveBeenCalled();
});

it('renders page without Add Widget button when feature flag is disabled', () => {
  setup();

  expect(screen.getByRole('button', { name: 'Add visualization' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Import dashboard' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add library panel' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add widget' })).not.toBeInTheDocument();
});

it('renders with buttons disabled when repository is read-only', () => {
  // Mock the hook to return read-only repository
  mockUseGetResourceRepositoryView.mockReturnValue({
    isReadOnlyRepo: true,
    isInstanceManaged: false,
    isLoading: false,
  });

  setup({ canCreate: true });

  expect(screen.getByRole('button', { name: 'Add visualization' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Import dashboard' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Add library panel' })).toBeDisabled();
});

describe('wrapperMaxWidth CSS class', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('applies wrapperMaxWidth class when dashboardLibrary feature is disabled', () => {
    config.featureToggles.dashboardLibrary = false;

    mockSearchParams.delete('dashboardLibraryDatasourceUid');

    const { container } = render(
      <DashboardEmpty dashboard={createDashboardModelFixture(defaultDashboard)} canCreate={true} />
    );

    const wrapperElement = container.querySelector('[class*="dashboard-empty-wrapper"]');
    expect(wrapperElement).toBeInTheDocument();
    expect(wrapperElement).toHaveStyle('max-width: 890px');
  });

  it('applies wrapperMaxWidth class when dashboardLibrary feature is enabled but no dashboardLibraryDatasourceUid param', () => {
    config.featureToggles.dashboardLibrary = true;

    mockSearchParams.delete('dashboardLibraryDatasourceUid');

    const { container } = render(
      <DashboardEmpty dashboard={createDashboardModelFixture(defaultDashboard)} canCreate={true} />
    );

    const wrapperElement = container.querySelector('[class*="dashboard-empty-wrapper"]');
    expect(wrapperElement).toBeInTheDocument();
    expect(wrapperElement).toHaveStyle('max-width: 890px');
  });

  it('does not apply wrapperMaxWidth class when dashboardLibrary feature is enabled and dashboardLibraryDatasourceUid param exists', () => {
    config.featureToggles.dashboardLibrary = true;

    mockSearchParams.set('dashboardLibraryDatasourceUid', 'test-uid');

    const { container } = render(
      <DashboardEmpty dashboard={createDashboardModelFixture(defaultDashboard)} canCreate={true} />
    );

    const wrapperElement = container.querySelector('[class*="dashboard-empty-wrapper"]');
    expect(wrapperElement).toBeInTheDocument();
    expect(wrapperElement).not.toHaveStyle('max-width: 890px');
  });
});
