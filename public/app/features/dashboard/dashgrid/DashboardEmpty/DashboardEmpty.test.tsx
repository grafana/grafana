import { act, fireEvent, screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { config, locationService, reportInteraction } from '@grafana/runtime';
import { defaultDashboard } from '@grafana/schema';
import { useDashboardGenerationAvailable } from 'app/features/dashboard-prompt/useDashboardGenerationAvailable';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { AutoGridLayoutManager } from 'app/features/dashboard-scene/scene/layout-auto-grid/AutoGridLayoutManager';

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
    getHistory: jest.fn(() => ({
      listen: jest.fn(),
    })),
  },
  reportInteraction: jest.fn(),
  getDataSourceSrv: jest.fn(() => ({
    getInstanceSettings: jest.fn((uid: string) => ({
      uid,
      name: 'Test Datasource',
      type: 'prometheus',
    })),
  })),
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

jest.mock('app/features/dashboard-prompt/useDashboardGenerationAvailable', () => ({
  useDashboardGenerationAvailable: jest.fn(() => false),
}));

jest.mock('app/features/dashboard-prompt/DashboardLandingPrompt', () => ({
  DashboardLandingPrompt: () => <div data-testid="dashboard-landing-prompt" />,
}));

const mockUseGetResourceRepositoryView = jest.mocked(
  require('app/features/provisioning/hooks/useGetResourceRepositoryView').useGetResourceRepositoryView
);
const mockUseDashboardGenerationAvailable = jest.mocked(useDashboardGenerationAvailable);

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

describe('new layouts empty state', () => {
  const originalDashboardNewLayouts = config.featureToggles.dashboardNewLayouts;

  afterEach(() => {
    config.featureToggles.dashboardNewLayouts = originalDashboardNewLayouts;
    mockUseDashboardGenerationAvailable.mockReturnValue(false);
  });

  function setupScene() {
    config.featureToggles.dashboardNewLayouts = true;
    const dashboard = new DashboardScene({
      isEditing: true,
      body: AutoGridLayoutManager.createEmpty(),
    });
    render(<DashboardEmpty dashboard={dashboard} canCreate />);
    return dashboard;
  }

  it('keeps the layout picker when assistant dashboard planning is off', () => {
    setupScene();

    expect(screen.getByText('Select layout')).toBeInTheDocument();
    expect(screen.queryByText('Or start blank')).not.toBeInTheDocument();
  });

  it('shows the assistant landing when planning is available', () => {
    mockUseDashboardGenerationAvailable.mockReturnValue(true);

    setupScene();

    expect(screen.getByTestId('dashboard-landing-prompt')).toBeInTheDocument();
    expect(screen.getByText('Or start blank')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add visualization' })).toBeInTheDocument();
    expect(screen.queryByText('Select layout')).not.toBeInTheDocument();
  });
});
