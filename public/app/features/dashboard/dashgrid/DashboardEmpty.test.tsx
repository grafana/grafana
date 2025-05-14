import { act, fireEvent, render, screen } from '@testing-library/react';

import { locationService, reportInteraction } from '@grafana/runtime';
import { defaultDashboard } from '@grafana/schema';

import { createDashboardModelFixture } from '../state/__fixtures__/dashboardFixtures';
import { onCreateNewPanel, onImportDashboard, onAddLibraryPanel } from '../utils/dashboard';

import DashboardEmpty, { Props } from './DashboardEmpty';

jest.mock('app/types', () => ({
  ...jest.requireActual('app/types'),
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

  expect(reportInteraction).toHaveBeenCalledWith('dashboards_emptydashboard_clicked', { item: 'add_visualization' });
  expect(locationService.partial).toHaveBeenCalled();
  expect(locationService.partial).toHaveBeenCalledWith({ editPanel: undefined, firstPanel: true });
  expect(onCreateNewPanel).toHaveBeenCalled();
});

it('open import dashboard when clicked Import dashboard', () => {
  setup();

  act(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Import dashboard' }));
  });

  expect(reportInteraction).toHaveBeenCalledWith('dashboards_emptydashboard_clicked', { item: 'import_dashboard' });
  expect(onImportDashboard).toHaveBeenCalled();
});

it('adds a library panel when clicked Add library panel', () => {
  setup();

  act(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Add library panel' }));
  });

  expect(reportInteraction).toHaveBeenCalledWith('dashboards_emptydashboard_clicked', { item: 'import_from_library' });
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
