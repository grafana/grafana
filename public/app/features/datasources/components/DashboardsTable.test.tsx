import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { PluginDashboard } from 'app/types';

import DashboardsTable, { Props } from './DashboardsTable';

const props: Props = {
  dashboards: [],
  onImport: jest.fn(),
  onRemove: jest.fn(),
};

const setup = (propOverrides?: object) => {
  Object.assign(props, propOverrides);

  render(<DashboardsTable {...props} />);
};

describe('DashboardsTable', () => {
  let mockDashboard: PluginDashboard;

  beforeEach(() => {
    mockDashboard = {
      dashboardId: 0,
      description: '',
      folderId: 0,
      imported: false,
      importedRevision: 0,
      importedUri: '',
      importedUrl: '',
      path: 'dashboards/carbon_metrics.json',
      pluginId: 'graphite',
      removed: false,
      revision: 0,
      slug: '',
      title: 'Graphite Carbon Metrics',
      uid: '',
    };
  });

  it('should render with no dashboards provided', () => {
    expect(() => setup()).not.toThrow();
    expect(screen.queryAllByRole('row').length).toEqual(0);
  });

  it('should render a row for each dashboard provided', () => {
    const mockDashboards = [mockDashboard, { ...mockDashboard, title: 'Graphite Carbon Metrics 2' }];
    setup({
      dashboards: mockDashboards,
    });

    expect(screen.getAllByRole('row').length).toEqual(2);
    mockDashboards.forEach((dashboard) => {
      expect(screen.getByRole('cell', { name: dashboard.title })).toBeInTheDocument();
    });
  });

  it('shows an import button if the dashboard has not been imported yet', async () => {
    const mockDashboards = [mockDashboard];
    setup({
      dashboards: mockDashboards,
    });

    const importButton = screen.getByRole('button', { name: 'Import' });
    expect(importButton).toBeInTheDocument();
    await userEvent.click(importButton);
    expect(props.onImport).toHaveBeenCalledWith(mockDashboards[0], false);
  });

  it('shows a re-import button if the dashboard has been imported and the revision id has not changed', async () => {
    const mockDashboards = [{ ...mockDashboard, imported: true }];
    setup({
      dashboards: mockDashboards,
    });

    const reimportButton = screen.getByRole('button', { name: 'Re-import' });
    expect(reimportButton).toBeInTheDocument();
    await userEvent.click(reimportButton);
    expect(props.onImport).toHaveBeenCalledWith(mockDashboards[0], true);
  });

  it('shows an update button if the dashboard has been imported and the revision id has changed', async () => {
    const mockDashboards = [{ ...mockDashboard, imported: true, revision: 1 }];
    setup({
      dashboards: mockDashboards,
    });

    const updateButton = screen.getByRole('button', { name: 'Update' });
    expect(updateButton).toBeInTheDocument();
    await userEvent.click(updateButton);
    expect(props.onImport).toHaveBeenCalledWith(mockDashboards[0], true);
  });

  it('shows a delete button if the dashboard has been imported', async () => {
    const mockDashboards = [{ ...mockDashboard, imported: true }];
    setup({
      dashboards: mockDashboards,
    });

    const deleteButton = screen.getByRole('button', { name: 'Delete dashboard' });
    expect(deleteButton).toBeInTheDocument();
    await userEvent.click(deleteButton);
    expect(props.onRemove).toHaveBeenCalledWith(mockDashboards[0]);
  });
});
