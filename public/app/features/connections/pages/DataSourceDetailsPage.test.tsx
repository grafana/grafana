import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { PluginType } from '@grafana/data';
import { addDataSource } from 'app/features/datasources/state/actions';
import { getCatalogPluginMock } from 'app/features/plugins/admin/mocks/mockHelpers';
import { isDataSourceEditor } from 'app/features/plugins/admin/permissions';

import { ROUTES } from '../constants';

import { DataSourcePluginAddButton } from './DataSourceDetailsPage';

jest.mock('app/features/datasources/state/actions', () => ({
  addDataSource: jest.fn(() => () => Promise.resolve()),
}));

jest.mock('app/features/plugins/admin/permissions', () => ({
  isDataSourceEditor: jest.fn(() => true),
}));

describe('DataSourcePluginAddButton', () => {
  beforeEach(() => {
    jest.mocked(addDataSource).mockClear();
    jest.mocked(isDataSourceEditor).mockReturnValue(true);
  });

  it('adds an uninstalled datasource plugin through the installable datasource flow', async () => {
    const plugin = getCatalogPluginMock({
      id: 'grafana-astradb-datasource',
      name: 'Astra DB',
      type: PluginType.datasource,
      isInstalled: false,
    });

    render(<DataSourcePluginAddButton plugin={plugin} />);

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(addDataSource).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'grafana-astradb-datasource',
        name: 'Astra DB',
        enabled: false,
      }),
      ROUTES.DataSourcesEdit
    );
  });

  it('adds an installed datasource plugin without marking it installable', async () => {
    const plugin = getCatalogPluginMock({
      id: 'grafana-astradb-datasource',
      name: 'Astra DB',
      type: PluginType.datasource,
      isInstalled: true,
    });

    render(<DataSourcePluginAddButton plugin={plugin} />);

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(addDataSource).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'grafana-astradb-datasource',
        enabled: true,
      }),
      ROUTES.DataSourcesEdit
    );
  });

  it('does not render when the user cannot create datasource connections', () => {
    jest.mocked(isDataSourceEditor).mockReturnValue(false);
    const plugin = getCatalogPluginMock({ type: PluginType.datasource });

    render(<DataSourcePluginAddButton plugin={plugin} />);

    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
  });
});
