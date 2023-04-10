import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { PluginType } from '@grafana/data';
import { locationService, reportInteraction } from '@grafana/runtime';
import { defaultDashboard } from '@grafana/schema';
import { createDashboardModelFixture } from 'app/features/dashboard/state/__fixtures__/dashboardFixtures';
import {
  onCreateNewPanel,
  onCreateNewRow,
  onAddLibraryPanel,
  getCopiedPanelPlugin,
} from 'app/features/dashboard/utils/dashboard';

import AddPanelMenu from './AddPanelMenu';

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
  getCopiedPanelPlugin: jest.fn(),
}));

function setup() {
  const props = {
    dashboard: createDashboardModelFixture(defaultDashboard),
  };
  const { rerender } = render(<AddPanelMenu dashboard={props.dashboard} />);

  return rerender;
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('renders menu list with correct menu items', () => {
  setup();

  expect(screen.getByText('visualization', { exact: false })).toBeInTheDocument();
  expect(screen.getByText('row', { exact: false })).toBeInTheDocument();
  expect(screen.getByText('library', { exact: false })).toBeInTheDocument();
  expect(screen.getByText('paste panel', { exact: false })).toBeInTheDocument();
});

it('renders with all buttons enabled except paste a panel', () => {
  // getCopiedPanelPluginMock().mockReset();

  setup();

  expect(screen.getByText('visualization', { exact: false })).not.toBeDisabled();
  expect(screen.getByText('row', { exact: false })).not.toBeDisabled();
  expect(screen.getByText('library', { exact: false })).not.toBeDisabled();
  expect(screen.getByText('paste panel', { exact: false })).toBeDisabled();
});

it('renders with all buttons enabled', () => {
  (getCopiedPanelPlugin as jest.Mock).mockReturnValue({
    id: 'someid',
    name: 'nameofit',
    type: PluginType.panel,
    info: {
      author: {
        name: 'author name',
      },
      description: 'description',
      links: [],
      logos: {
        small: 'small',
        large: 'large',
      },
      updated: 'updated',
      version: 'version',
    },
    module: 'module',
    baseUrl: 'url',
    sort: 2,
    defaults: { gridPos: { w: 200, h: 100 }, title: 'some title' },
  });

  setup();

  expect(screen.getByText('visualization', { exact: false })).not.toBeDisabled();
  expect(screen.getByText('row', { exact: false })).not.toBeDisabled();
  expect(screen.getByText('library', { exact: false })).not.toBeDisabled();
  expect(screen.getByText('paste panel', { exact: false })).not.toBeDisabled();
});

it('creates new visualization when clicked on menu item Visualization', () => {
  setup();

  act(() => {
    fireEvent.click(screen.getByRole('menuitem', { name: 'Visualization' }));
  });

  expect(reportInteraction).toHaveBeenCalledWith('Create new panel');
  expect(locationService.partial).toHaveBeenCalled();
  expect(onCreateNewPanel).toHaveBeenCalled();
});

it('creates new row when clicked on menu item Row', () => {
  setup();

  act(() => {
    fireEvent.click(screen.getByRole('menuitem', { name: 'Row' }));
  });

  expect(reportInteraction).toHaveBeenCalledWith('Create new row');
  expect(locationService.partial).not.toHaveBeenCalled();
  expect(onCreateNewRow).toHaveBeenCalled();
});

it('adds a library panel when clicked on menu item Import from library', () => {
  setup();

  act(() => {
    fireEvent.click(screen.getByRole('menuitem', { name: 'Import from library' }));
  });

  expect(reportInteraction).toHaveBeenCalledWith('Add a panel from the panel library');
  expect(locationService.partial).not.toHaveBeenCalled();
  expect(onAddLibraryPanel).toHaveBeenCalled();
});
