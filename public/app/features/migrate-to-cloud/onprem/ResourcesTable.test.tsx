import { render as rtlRender, screen } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import { setBackendSrv, config } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';

import {
  wellFormedDashboardMigrationItem,
  wellFormedDatasourceMigrationItem,
  wellFormedLibraryElementMigrationItem,
} from '../fixtures/migrationItems';
import { registerMockAPI } from '../fixtures/mswAPI';
import { wellFormedDatasource } from '../fixtures/others';

import { ResourcesTable, ResourcesTableProps } from './ResourcesTable';

setBackendSrv(backendSrv);

function render(props: Partial<ResourcesTableProps>) {
  rtlRender(
    <TestProvider>
      <ResourcesTable
        onChangePage={() => {}}
        numberOfPages={10}
        page={0}
        resources={props.resources || []}
        localPlugins={[]}
      />
    </TestProvider>
  );
}

describe('ResourcesTable', () => {
  registerMockAPI();

  let originalDatasources: (typeof config)['datasources'];

  const datasourceA = wellFormedDatasource(1, {
    uid: 'datasource-a-uid',
    name: 'Datasource A',
  });

  beforeAll(() => {
    originalDatasources = config.datasources;

    config.datasources = {
      ...config.datasources,
      [datasourceA.name]: datasourceA,
    };
  });

  afterAll(() => {
    config.datasources = originalDatasources;
  });

  it('renders data sources', async () => {
    const resources = [
      wellFormedDatasourceMigrationItem(1, {
        refId: datasourceA.uid,
      }),
    ];

    render({ resources });

    expect(screen.getByText('Datasource A')).toBeInTheDocument();
  });

  it('renders data sources when their data is missing', () => {
    const item = wellFormedDatasourceMigrationItem(2);
    const resources = [item];

    render({ resources });

    expect(screen.getByText(`Data source ${item.refId}`)).toBeInTheDocument();
    expect(screen.getByText(`Unknown data source`)).toBeInTheDocument();
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

  it('renders the success status correctly', () => {
    const resources = [
      wellFormedDatasourceMigrationItem(1, {
        refId: datasourceA.uid,
        status: 'OK',
      }),
    ];

    render({ resources });

    expect(screen.getByText('Uploaded to cloud')).toBeInTheDocument();
  });

  it('renders the error status correctly', () => {
    const resources = [
      wellFormedDatasourceMigrationItem(1, {
        refId: datasourceA.uid,
        status: 'ERROR',
      }),
    ];

    render({ resources });

    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it("shows a details button when there's an error message", () => {
    const resources = [
      wellFormedDatasourceMigrationItem(1, {
        refId: datasourceA.uid,
        status: 'ERROR',
        message: 'Some error',
      }),
    ];

    render({ resources });

    expect(
      screen.getByRole('button', {
        name: 'Details',
      })
    ).toBeInTheDocument();
  });

  it('renders the warning status correctly', () => {
    const resources = [
      wellFormedDatasourceMigrationItem(1, {
        refId: datasourceA.uid,
        status: 'WARNING',
      }),
    ];

    render({ resources });

    expect(screen.getByText('Uploaded with warning')).toBeInTheDocument();
  });

  it("shows a details button when there's a warning message", () => {
    const resources = [
      wellFormedDatasourceMigrationItem(1, {
        refId: datasourceA.uid,
        status: 'WARNING',
        message: 'Some warning',
      }),
    ];

    render({ resources });

    expect(
      screen.getByRole('button', {
        name: 'Details',
      })
    ).toBeInTheDocument();
  });
});
