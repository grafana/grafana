import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { locationService, reportInteraction } from '@grafana/runtime';
import { defaultDashboard } from '@grafana/schema';

import { createDashboardModelFixture } from '../state/__fixtures__/dashboardFixtures';
import { onCreateNewPanel, onCreateNewRow, onAddLibraryPanel } from '../utils/dashboard';

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
  config: {},
}));

jest.mock('app/features/dashboard/utils/dashboard', () => ({
  onCreateNewPanel: jest.fn(),
  onCreateNewRow: jest.fn(),
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
  expect(screen.getByRole('button', { name: 'Add row' })).not.toBeDisabled();
  expect(screen.getByRole('button', { name: 'Import library panel' })).not.toBeDisabled();
});

it('renders with all buttons disabled when canCreate is false', () => {
  setup({ canCreate: false });

  expect(screen.getByRole('button', { name: 'Add visualization' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Add row' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Import library panel' })).toBeDisabled();
});

it('creates new visualization when clicked Add visualization', () => {
  setup();

  act(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Add visualization' }));
  });

  expect(reportInteraction).toHaveBeenCalledWith('dashboards_emptydashboard_clicked', { item: 'add_visualization' });
  expect(locationService.partial).toHaveBeenCalled();
  expect(onCreateNewPanel).toHaveBeenCalled();
});

it('creates new row when clicked Add row', () => {
  setup();

  act(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Add row' }));
  });

  expect(reportInteraction).toHaveBeenCalledWith('dashboards_emptydashboard_clicked', { item: 'add_row' });
  expect(locationService.partial).not.toHaveBeenCalled();
  expect(onCreateNewRow).toHaveBeenCalled();
});

it('adds a library panel when clicked Import library panel', () => {
  setup();

  act(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Import library panel' }));
  });

  expect(reportInteraction).toHaveBeenCalledWith('dashboards_emptydashboard_clicked', { item: 'import_from_library' });
  expect(locationService.partial).not.toHaveBeenCalled();
  expect(onAddLibraryPanel).toHaveBeenCalled();
});
