import { render as rtlRender, screen } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import { setBackendSrv } from '@grafana/runtime';
import { setDataSourceInstanceSettings, setDatasourcePluginMetas } from '@grafana/runtime/internal';
import { backendSrv } from 'app/core/services/backend_srv';
import { getLocalPluginMock } from 'app/features/plugins/admin/mocks/mockHelpers';

import {
  wellFormedDashboardMigrationItem,
  wellFormedDatasourceMigrationItem,
  wellFormedLibraryElementMigrationItem,
  wellFormedPluginMigrationItem,
} from '../fixtures/migrationItems';
import { registerMockAPI } from '../fixtures/mswAPI';
import { wellFormedDatasource } from '../fixtures/others';

import { ResourcesTable, type ResourcesTableProps } from './ResourcesTable';

setBackendSrv(backendSrv);

function render(props: Partial<ResourcesTableProps>) {
  return rtlRender(
    <TestProvider>
      <ResourcesTable
        onChangeSort={() => {}}
        onChangePage={() => {}}
        numberOfPages={10}
        page={0}
        resources={props.resources || []}
        localPlugins={props.localPlugins || []}
      />
    </TestProvider>
  );
}

describe('ResourcesTable', () => {
  registerMockAPI();

  const datasourceA = wellFormedDatasource(1, {
    uid: 'datasource-a-uid',
    name: 'Datasource A',
  });

  beforeEach(() => {
    setDataSourceInstanceSettings({ [datasourceA.name]: datasourceA });
    setDatasourcePluginMetas({ [datasourceA.type]: datasourceA.meta });
  });

  it('renders data sources', async () => {
    const resources = [
      wellFormedDatasourceMigrationItem(1, {
        refId: datasourceA.uid,
      }),
    ];

    render({ resources });

    expect(await screen.findByText('Datasource A')).toBeInTheDocument();
  });

  it('renders data sources when their data is missing', async () => {
    const item = wellFormedDatasourceMigrationItem(2);
    const resources = [item];

    render({ resources });

    expect(await screen.findByText(`Data source ${item.refId}`)).toBeInTheDocument();
    expect(screen.getByText(`Unknown data source`)).toBeInTheDocument();
  });

  it('renders the data source logo', async () => {
    const resources = [wellFormedDatasourceMigrationItem(1, { refId: datasourceA.uid })];

    const { container } = render({ resources });
    await screen.findByText('Datasource A');

    // The logo is decorative (alt=""), so it has no accessible name to query by.
    expect(container.querySelector('img')).toHaveAttribute('src', datasourceA.meta.info.logos.small);
  });

  it('renders plugins with their logo', () => {
    const plugin = getLocalPluginMock();
    const resources = [
      wellFormedPluginMigrationItem(1, {
        refId: plugin.id,
        name: plugin.name,
        parentName: 'Plugins',
      }),
    ];

    const { container } = render({ resources, localPlugins: [plugin] });

    expect(screen.getByText(plugin.name)).toBeInTheDocument();
    expect(screen.getByText('Plugins')).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('src', plugin.info.logos.small);
  });

  it('renders dashboards', async () => {
    const resources = [wellFormedDashboardMigrationItem(1)];

    render({ resources });

    expect(await screen.findByText('My Dashboard')).toBeInTheDocument();
  });

  it('renders dashboards when their data is missing', async () => {
    const resources = [
      wellFormedDashboardMigrationItem(2, {
        refId: 'dashboard-404',
      }),
    ];

    render({ resources });

    expect(await screen.findByText('Unable to load dashboard')).toBeInTheDocument();
    expect(await screen.findByText('Dashboard dashboard-404')).toBeInTheDocument();
  });

  it('renders library elements', async () => {
    const resources = [wellFormedLibraryElementMigrationItem(1)];

    render({ resources });

    expect(await screen.findByText('My Library Element')).toBeInTheDocument();
    expect(await screen.findByText('FolderName')).toBeInTheDocument();
  });

  it('renders library elements when their data is missing', async () => {
    const resources = [
      wellFormedLibraryElementMigrationItem(2, {
        refId: 'library-element-404',
      }),
    ];

    render({ resources });

    expect(await screen.findByText('Unable to load library element')).toBeInTheDocument();
    expect(await screen.findByText('Library Element library-element-404')).toBeInTheDocument();
  });

  it('renders the success status correctly', async () => {
    const resources = [
      wellFormedDatasourceMigrationItem(1, {
        refId: datasourceA.uid,
        status: 'OK',
      }),
    ];

    render({ resources });
    await screen.findByText('Datasource A');

    expect(screen.getByText('Uploaded to cloud')).toBeInTheDocument();
  });

  it('renders the error status correctly', async () => {
    const resources = [
      wellFormedDatasourceMigrationItem(1, {
        refId: datasourceA.uid,
        status: 'ERROR',
      }),
    ];

    render({ resources });
    await screen.findByText('Datasource A');

    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it("shows a details button when there's an error message", async () => {
    const resources = [
      wellFormedDatasourceMigrationItem(1, {
        refId: datasourceA.uid,
        status: 'ERROR',
        message: 'Some error',
      }),
    ];

    render({ resources });
    await screen.findByText('Datasource A');

    expect(
      screen.getByRole('button', {
        name: 'Details',
      })
    ).toBeInTheDocument();
  });

  it('renders the warning status correctly', async () => {
    const resources = [
      wellFormedDatasourceMigrationItem(1, {
        refId: datasourceA.uid,
        status: 'WARNING',
      }),
    ];

    render({ resources });
    await screen.findByText('Datasource A');

    expect(screen.getByText('Uploaded with warning')).toBeInTheDocument();
  });

  it("shows a details button when there's a warning message", async () => {
    const resources = [
      wellFormedDatasourceMigrationItem(1, {
        refId: datasourceA.uid,
        status: 'WARNING',
        message: 'Some warning',
      }),
    ];

    render({ resources });
    await screen.findByText('Datasource A');

    expect(
      screen.getByRole('button', {
        name: 'Details',
      })
    ).toBeInTheDocument();
  });
});
